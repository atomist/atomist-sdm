/*
 * Copyright © 2018 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// tslint:disable:max-file-line-count

import {
    logger,
    Success,
} from "@atomist/automation-client";
import { CommandResult } from "@atomist/automation-client/action/cli/commandLine";
import { configurationValue } from "@atomist/automation-client/configuration";
import { GitHubRepoRef } from "@atomist/automation-client/operations/common/GitHubRepoRef";
import { TokenCredentials } from "@atomist/automation-client/operations/common/ProjectOperationCredentials";
import { RemoteRepoRef } from "@atomist/automation-client/operations/common/RepoId";
import { GitCommandGitProject } from "@atomist/automation-client/project/git/GitCommandGitProject";
import { GitProject } from "@atomist/automation-client/project/git/GitProject";
import { NodeFsLocalProject } from "@atomist/automation-client/project/local/NodeFsLocalProject";
import {
    branchFromCommit,
    createTagForStatus,
    DelimitedWriteProgressLogDecorator,
    DockerOptions,
    ExecuteGoalResult,
    ExecuteGoalWithLog,
    NpmOptions,
    PrepareForGoalExecution,
    ProgressLog,
    ProjectIdentifier,
    ProjectLoader,
    readSdmVersion,
    RunWithLogContext,
} from "@atomist/sdm";
import {
    DockerBuildGoal,
    TagGoal,
    VersionGoal,
} from "@atomist/sdm/common/delivery/goals/common/commonGoals";
import {
    createRelease,
    createStatus,
} from "@atomist/sdm/util/github/ghub";
import {
    ChildProcessResult,
    spawnAndWatch,
    SpawnCommand,
} from "@atomist/sdm/util/misc/spawned";
import { SpawnOptions } from "child_process";
import * as fs from "fs-extra";
import * as path from "path";
import * as uuid from "uuid/v4";

interface ProjectRegistryInfo {
    registry: string;
    name: string;
    version: string;
}

async function rwlcVersion(rwlc: RunWithLogContext): Promise<string> {
    const commit = rwlc.status.commit;
    const version = await readSdmVersion(
        commit.repo.owner,
        commit.repo.name,
        commit.repo.org.provider.providerId,
        commit.sha,
        branchFromCommit(commit),
        rwlc.context);
    return version;
}

function releaseVersion(version: string): string {
    return version.replace(/-.*/, "");
}

function npmPackageUrl(p: ProjectRegistryInfo): string {
    return `${p.registry}/${p.name}/-/${p.name}-${p.version}.tgz`;
}

function dockerImage(p: ProjectRegistryInfo): string {
    return `${p.registry}/${p.name}:${p.version}`;
}

type ExecuteLogger = (l: ProgressLog) => Promise<ExecuteGoalResult>;

interface SpawnWatchCommand {
    cmd: SpawnCommand;
    cwd?: string;
}

/**
 * Transform a SpawnWatchCommand into an ExecuteLogger suitable for
 * execution by executeLoggers.  The operation is awaited and any
 * thrown exceptions are caught and transformed into an error result.
 * If an error occurs, it is logged.  The result of the operation is
 * transformed into a ExecuteGoalResult.  If an exception is caught,
 * the returned code is guaranteed to be non-zero.
 */
function spawnExecuteLogger(swc: SpawnWatchCommand): ExecuteLogger {

    return async (log: ProgressLog) => {
        const opts: SpawnOptions = {};
        if (swc.cwd) {
            opts.cwd = swc.cwd;
        }
        let res: ChildProcessResult;
        try {
            res = await spawnAndWatch(swc.cmd, opts, log);
        } catch (e) {
            res = {
                error: true,
                code: -1,
                message: `Spawned command errored: ${swc.cmd.command} ${swc.cmd.args.join(" ")}: ${e.message}`,
            };
        }
        if (res.error) {
            if (!res.message) {
                res.message = `Spawned command failed (status:${res.code}): ${swc.cmd.command} ${swc.cmd.args.join(" ")}`;
            }
            logger.error(res.message);
            log.write(res.message);
        }
        return res;
    };
}

/**
 * Transform a GitCommandGitProject operation into an ExecuteLogger
 * suitable for execution by executeLoggers.  The operation is awaited
 * and any thrown exceptions are caught and transformed into an error
 * result.  The returned standard out and standard error are written
 * to the log.  If an error occurs, it is logged.  The result of the
 * operation is transformed into a ExecuteGoalResult.  If an error is
 * returned or exception caught, the returned code is guaranteed to be
 * non-zero.
 */
function gitExecuteLogger(gp: GitCommandGitProject, op: () => Promise<CommandResult<GitCommandGitProject>>): ExecuteLogger {

    return async (log: ProgressLog) => {
        let res: CommandResult<GitCommandGitProject>;
        try {
            res = await op();
        } catch (e) {
            res = {
                error: e,
                success: false,
                childProcess: {
                    exitCode: -1,
                    killed: true,
                    pid: 99999,
                },
                stdout: `Error: ${e.message}`,
                stderr: `Error: ${e.stack}`,
                target: gp,
            };
        }
        log.write(res.stdout);
        log.write(res.stderr);
        if (res.error) {
            res.childProcess.exitCode = (res.childProcess.exitCode === 0) ? 999 : res.childProcess.exitCode;
        }
        const message = (res.error && res.error.message) ? res.error.message :
            ((res.childProcess.exitCode !== 0) ? `Git command failed: ${res.stderr}` : undefined);
        if (res.childProcess.exitCode !== 0) {
            logger.error(message);
            log.write(message);
        }
        const egr: ExecuteGoalResult = {
            code: res.childProcess.exitCode,
            message,
        };
        return egr;
    };
}

/**
 * Execute an array of logged commands, creating a line-delimited
 * progress log beforehand, flushing after each command, and closing
 * it at the end.  If any command fails, bail out and return the
 * failure result.  Otherwise return Success.
 */
async function executeLoggers(els: ExecuteLogger[], progressLog: ProgressLog): Promise<ExecuteGoalResult> {
    const log = new DelimitedWriteProgressLogDecorator(progressLog, "\n");
    for (const cmd of els) {
        const res = await cmd(log);
        await log.flush();
        if (res.code !== 0) {
            await log.close();
            return res;
        }
    }
    await log.close();
    return Success;
}

export async function npmReleasePreparation(p: GitProject, rwlc: RunWithLogContext): Promise<ExecuteGoalResult> {
    const pjFile = await p.getFile("package.json");
    if (!pjFile) {
        const msg = `NPM project does not have a package.json`;
        logger.error(msg);
        return Promise.reject(new Error(msg));
    }
    const pjContents = await pjFile.getContent();
    let pj: { name: string };
    try {
        pj = JSON.parse(pjContents);
    } catch (e) {
        e.message = `Unable to parse package.json '${pjContents}': ${e.message}`;
        logger.error(e.message);
        return Promise.reject(e);
    }
    if (!pj.name) {
        const msg = `Unable to get NPM package name from package.json '${pjContents}'`;
        logger.error(msg);
        return Promise.reject(new Error(msg));
    }
    const version = await rwlcVersion(rwlc);
    const versionRelease = releaseVersion(version);
    const npmOptions = configurationValue<NpmOptions>("sdm.npm");
    if (!npmOptions.registry) {
        return Promise.reject(new Error(`No NPM registry defined in NPM options`));
    }
    const pkgUrl = npmPackageUrl({
        registry: npmOptions.registry,
        name: pj.name,
        version,
    });
    const tmpDir = path.join((process.env.TMPDIR || "/tmp"), `${p.name}-${uuid()}`);
    const tgz = path.join(tmpDir, "package.tgz");

    const cmds: SpawnWatchCommand[] = [
        {
            cmd: { command: "curl", args: ["--output", tgz, "--silent", "--fail", "--create-dirs", pkgUrl] },
        },
        {
            cmd: { command: "tar", args: ["-x", "-z", "-f", tgz] },
            cwd: tmpDir,
        },
        {
            cmd: { command: "bash", args: ["-c", "rm -r *"] },
            cwd: p.baseDir,
        },
        {
            cmd: { command: "cp", args: ["-r", "package/.", p.baseDir] },
            cwd: tmpDir,
        },
        {
            cmd: { command: "npm", args: ["--no-git-tag-version", "version", versionRelease] },
            cwd: p.baseDir,
        },
        {
            cmd: { command: "rm", args: ["-rf", tmpDir] },
        },
    ];
    const els = cmds.map(spawnExecuteLogger);
    return executeLoggers(els, rwlc.progressLog);
}

export const NpmReleasePreparations: PrepareForGoalExecution[] = [npmReleasePreparation];

export function executeReleaseNpm(
    projectLoader: ProjectLoader,
    projectIdentifier: ProjectIdentifier,
    preparations: PrepareForGoalExecution[] = NpmReleasePreparations,
    options?: NpmOptions,
): ExecuteGoalWithLog {

    if (!options.npmrc) {
        throw new Error(`No npmrc defined in NPM options`);
    }
    return async (rwlc: RunWithLogContext): Promise<ExecuteGoalResult> => {
        const { credentials, id, context } = rwlc;
        return projectLoader.doWithProject({ credentials, id, context, readOnly: false }, async (project: GitProject) => {

            await fs.writeFile(path.join(project.baseDir, ".npmrc"), options.npmrc);

            for (const preparation of preparations) {
                const pResult = await preparation(project, rwlc);
                if (pResult.code !== 0) {
                    return pResult;
                }
            }

            const result = await spawnAndWatch({
                command: "npm",
                args: [
                    "publish",
                    "--registry", options.registry,
                    "--access", (options.access) ? options.access : "restricted",
                ],
            }, { cwd: project.baseDir }, rwlc.progressLog);
            if (result.error) {
                return result;
            }

            const pi = await projectIdentifier(project);
            const url = npmPackageUrl({
                registry: options.registry,
                name: pi.name,
                version: pi.version,
            });
            await createStatus(
                (credentials as TokenCredentials).token,
                id as GitHubRepoRef,
                {
                    context: "npm/atomist/package",
                    description: "NPM package",
                    target_url: url,
                    state: "success",
                });

            const egr: ExecuteGoalResult = {
                code: result.code,
                message: result.message,
                targetUrl: url,
            };
            return egr;
        });
    };
}

export async function dockerReleasePreparation(p: GitProject, rwlc: RunWithLogContext): Promise<ExecuteGoalResult> {
    const version = await rwlcVersion(rwlc);
    const dockerOptions = configurationValue<DockerOptions>("sdm.docker.hub");
    const image = dockerImage({
        registry: dockerOptions.registry,
        name: p.name,
        version,
    });

    const cmds: SpawnWatchCommand[] = [
        {
            cmd: {
                command: "docker",
                args: ["login", "--username", dockerOptions.user, "--password", dockerOptions.password],
            },
        },
        {
            cmd: { command: "docker", args: ["pull", image] },
        },
    ];
    const els = cmds.map(spawnExecuteLogger);
    return executeLoggers(els, rwlc.progressLog);
}

export const DockerReleasePreparations: PrepareForGoalExecution[] = [dockerReleasePreparation];

export function executeReleaseDocker(
    projectLoader: ProjectLoader,
    preparations: PrepareForGoalExecution[] = DockerReleasePreparations,
    options?: DockerOptions,
): ExecuteGoalWithLog {

    return async (rwlc: RunWithLogContext): Promise<ExecuteGoalResult> => {
        const { credentials, id, context } = rwlc;
        if (!options.registry) {
            throw new Error(`No registry defined in Docker options`);
        }
        return projectLoader.doWithProject({ credentials, id, context, readOnly: false }, async (project: GitProject) => {

            for (const preparation of preparations) {
                const pResult = await preparation(project, rwlc);
                if (pResult.code !== 0) {
                    return pResult;
                }
            }

            const commit = rwlc.status.commit;
            const version = await rwlcVersion(rwlc);
            const versionRelease = releaseVersion(version);
            const image = dockerImage({
                registry: options.registry,
                name: commit.repo.name,
                version,
            });
            const tag = dockerImage({
                registry: options.registry,
                name: commit.repo.name,
                version: versionRelease,
            });

            const cmds: SpawnWatchCommand[] = [
                {
                    cmd: { command: "docker", args: ["tag", image, tag] },
                },
                {
                    cmd: { command: "docker", args: ["push", tag] },
                },
                {
                    cmd: { command: "docker", args: ["rmi", tag] },
                },
            ];
            const els = cmds.map(spawnExecuteLogger);
            return executeLoggers(els, rwlc.progressLog);
        });
    };
}

/**
 * Create release semantic version tag and GitHub release for that tag.
 */
export function executeReleaseTag(projectLoader: ProjectLoader): ExecuteGoalWithLog {
    return async (rwlc: RunWithLogContext): Promise<ExecuteGoalResult> => {
        const { status, credentials, id, context } = rwlc;

        return projectLoader.doWithProject({ credentials, id, context, readOnly: true }, async p => {
            const commit = status.commit;
            const version = await rwlcVersion(rwlc);
            const versionRelease = releaseVersion(version);
            await createTagForStatus(id, commit.sha, commit.message, versionRelease, credentials);
            const commitTitle = commit.message.replace(/\n[\S\s]*/, "");
            const release = {
                tag_name: versionRelease,
                name: `${versionRelease}: ${commitTitle}`,
            };
            const rrr = p.id as RemoteRepoRef;
            const targetUrl = `${rrr.url}/releases/tag/${versionRelease}`;
            const egr: ExecuteGoalResult = {
                ...Success,
                targetUrl,
            };
            return createRelease((credentials as TokenCredentials).token, id as GitHubRepoRef, release)
                .then(() => egr);
        });
    };
}

function typedocDir(baseDir: string): string {
    return path.join(baseDir, "build", "typedoc");
}

export async function docsReleasePreparation(p: GitProject, rwlc: RunWithLogContext): Promise<ExecuteGoalResult> {
    const cmds: SpawnWatchCommand[] = [
        {
            cmd: { command: "npm", args: ["ci"] },
            cwd: p.baseDir,
        },
        {
            cmd: { command: "npm", args: ["run", "compile"] },
            cwd: p.baseDir,
        },
        {
            cmd: { command: "npm", args: ["run", "typedoc"] },
            cwd: p.baseDir,
        },
        {
            cmd: { command: "touch", args: [path.join(typedocDir(p.baseDir), ".nojekyll")] },
            cwd: p.baseDir,
        },
    ];
    const els = cmds.map(spawnExecuteLogger);
    return executeLoggers(els, rwlc.progressLog);
}

export const DocsReleasePreparations: PrepareForGoalExecution[] = [docsReleasePreparation];

/**
 * Publish TypeDoc to gh-pages branch.
 */
export function executeReleaseDocs(
    projectLoader: ProjectLoader,
    preparations: PrepareForGoalExecution[] = DocsReleasePreparations,
): ExecuteGoalWithLog {

    return async (rwlc: RunWithLogContext): Promise<ExecuteGoalResult> => {
        const { credentials, id, context } = rwlc;
        return projectLoader.doWithProject({ credentials, id, context, readOnly: false }, async (project: GitProject) => {

            for (const preparation of preparations) {
                const pResult = await preparation(project, rwlc);
                if (pResult.code !== 0) {
                    return pResult;
                }
            }

            const version = await rwlcVersion(rwlc);
            const versionRelease = releaseVersion(version);
            const commitMsg = `Publishing TypeDoc for version ${versionRelease}`;
            const docDir = typedocDir(project.baseDir);
            const docProject = await NodeFsLocalProject.fromExistingDirectory(project.id, docDir);
            const docGitProject = GitCommandGitProject.fromProject(docProject, credentials) as GitCommandGitProject;
            const targetUrl = `https://${docGitProject.id.owner}.github.io/${docGitProject.id.repo}`;
            const rrr = project.id as RemoteRepoRef;

            const gitOps: Array<() => Promise<CommandResult<GitCommandGitProject>>> = [
                () => docGitProject.init(),
                () => docGitProject.commit(commitMsg),
                () => docGitProject.createBranch("gh-pages"),
                () => docGitProject.setRemote(rrr.cloneUrl(credentials)),
                () => docGitProject.push(),
            ];
            const els = gitOps.map(op => gitExecuteLogger(docGitProject, op));
            const gitRes = await executeLoggers(els, rwlc.progressLog);
            if (gitRes.code !== 0) {
                return gitRes;
            }
            return { ...Success, targetUrl };
        });
    };
}

/**
 * Increment patch level in package.json version.
 */
export function executeReleaseVersion(
    projectLoader: ProjectLoader,
    projectIdentifier: ProjectIdentifier,
): ExecuteGoalWithLog {

    return async (rwlc: RunWithLogContext): Promise<ExecuteGoalResult> => {
        const { status, credentials, id, context } = rwlc;

        return projectLoader.doWithProject({ credentials, id, context, readOnly: false }, async p => {
            const commit = rwlc.status.commit;
            const version = await rwlcVersion(rwlc);
            const versionRelease = releaseVersion(version);
            const gp = p as GitCommandGitProject;

            const branch = "master";
            const remote = gp.remote || "origin";
            const preEls: ExecuteLogger[] = [
                gitExecuteLogger(gp, () => gp.checkout(branch)),
                spawnExecuteLogger({ cmd: { command: "git", args: ["pull", remote, branch] }, cwd: gp.baseDir }),
            ];
            const preRes = await executeLoggers(preEls, rwlc.progressLog);
            if (preRes.code !== 0) {
                return preRes;
            }
            gp.branch = branch;

            const pi = await projectIdentifier(p);
            if (pi.version !== versionRelease) {
                const message = `current master package version (${pi.version}) seems to have already been ` +
                    `incremented after ${releaseVersion} release`;
                console.debug(message);
                const log = new DelimitedWriteProgressLogDecorator(rwlc.progressLog, "\n");
                log.write(`${message}\n`);
                await log.flush();
                await log.close();
                return { ...Success, message };
            }

            const postEls: ExecuteLogger[] = [
                spawnExecuteLogger({ cmd: { command: "npm", args: ["version", "--no-git-tag-version", "patch"] }, cwd: gp.baseDir }),
                gitExecuteLogger(gp, () => gp.commit(`Increment version after ${versionRelease} release`)),
                gitExecuteLogger(gp, () => gp.push()),
            ];
            return executeLoggers(postEls, rwlc.progressLog);
        });
    };
}
