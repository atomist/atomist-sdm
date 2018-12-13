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
    configurationValue,
    GitCommandGitProject,
    GitHubRepoRef,
    GitProject,
    logger,
    NodeFsLocalProject,
    RemoteRepoRef,
    Success,
    TokenCredentials,
} from "@atomist/automation-client";
import {
    DelimitedWriteProgressLogDecorator,
    ExecuteGoal,
    ExecuteGoalResult,
    GoalInvocation,
    PrepareForGoalExecution,
    ProgressLog,
    PushTest,
    spawnLog,
    SpawnLogCommand,
    SpawnLogOptions,
} from "@atomist/sdm";
import {
    createTagForStatus,
    github,
    ProjectIdentifier,
    readSdmVersion,
} from "@atomist/sdm-core";
import { DockerOptions } from "@atomist/sdm-pack-docker";
import {
    DevelopmentEnvOptions,
    NpmOptions,
} from "@atomist/sdm-pack-node";
import * as fs from "fs-extra";
import * as _ from "lodash";
import * as path from "path";
import * as semver from "semver";
import * as uuid from "uuid/v4";

async function loglog(log: ProgressLog, msg: string): Promise<void> {
    logger.debug(msg);
    log.write(`${msg}\n`);
    await log.flush();
}

interface ProjectRegistryInfo {
    registry: string;
    name: string;
    version: string;
}

export async function rwlcVersion(gi: GoalInvocation): Promise<string> {
    const version = await readSdmVersion(
        gi.goalEvent.repo.owner,
        gi.goalEvent.repo.name,
        gi.goalEvent.repo.providerId,
        gi.goalEvent.sha,
        gi.goalEvent.branch,
        gi.context);
    return version;
}

export function releaseOrPreRelease(version: string, gi: GoalInvocation): string {
    const prVersion = preReleaseVersion(gi);
    if (prVersion) {
        return prVersion;
    } else {
        return releaseVersion(version);
    }
}

function preReleaseVersion(gi: GoalInvocation): string | undefined {
    const tags = _.get(gi, "goalEvent.push.after.tags") || [];
    const tag = tags.find(t => {
        if (isNextVersion(t.name)) {
            return true;
        } else {
            return false;
        }
    });
    if (tag) {
        return tag.name;
    } else {
        return undefined;
    }
}

function isNextVersion(version: string): boolean {
    const preRelease = semver.prerelease(version);
    return (preRelease && ["M", "RC"].includes(preRelease[0]));
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
    cmd: SpawnLogCommand;
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
        const opts: SpawnLogOptions = {
            ...swc.cmd.options,
            log,
        };
        if (swc.cwd) {
            opts.cwd = swc.cwd;
        }
        let res;
        try {
            res = await spawnLog(swc.cmd.command, swc.cmd.args, opts);
        } catch (e) {
            res = {
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
function gitExecuteLogger(
    gp: GitCommandGitProject,
    op: () => Promise<GitCommandGitProject>,
    name: string,
): ExecuteLogger {

    return async (log: ProgressLog) => {
        log.write(`Running: git ${name}`);
        try {
            await op();
            log.write(`Success: git ${name}`);
            return { code: 0 };
        } catch (e) {
            log.write(e.stdout);
            log.write(e.stderr);
            const message = `Failure: git ${name}: ${e.message}`;
            log.write(message);
            return {
                code: e.code,
                message,
            };
        }
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
            return res;
        }
    }
    return Success;
}

/**
 * Information about local NPM package tgz file.
 */
export interface NpmPackageInfo {
    /** Local file system path to package tgz */
    path: string;
    /** URL where package was downloaded from */
    url: string;
    /** Version of package */
    version: string;
}

/**
 * Download the pre-release NPM package related to this project and
 * goal invocation and provide information back about it.  The caller
 * is responsible for cleaning up the downloaded files and its parent
 * directory.
 *
 * @param p Project to download NPM package for
 * @param gi Download package generated by this goal invocation
 * @return information about the NPM package
 */
export async function downloadNpmPackage(p: GitProject, gi: GoalInvocation, version?: string): Promise<NpmPackageInfo> {
    const pjFile = await p.getFile("package.json");
    if (!pjFile) {
        const msg = `NPM project does not have a package.json`;
        logger.error(msg);
        throw new Error(msg);
    }
    const pjContents = await pjFile.getContent();
    let pj: { name: string };
    try {
        pj = JSON.parse(pjContents);
    } catch (e) {
        e.message = `Unable to parse package.json '${pjContents}': ${e.message}`;
        logger.error(e.message);
        throw e;
    }
    if (!pj.name) {
        const msg = `Unable to get NPM package name from package.json '${pjContents}'`;
        logger.error(msg);
        throw new Error(msg);
    }
    const pkgVersion = (version) ? version : await rwlcVersion(gi);
    const npmOptions = configurationValue<NpmOptions>("sdm.npm");
    if (!npmOptions.registry) {
        throw new Error(`No NPM registry defined in NPM options`);
    }
    const pkgUrl = npmPackageUrl({
        registry: npmOptions.registry,
        name: pj.name,
        version: pkgVersion,
    });
    const tmpDir = path.join((process.env.TMPDIR || "/tmp"), `${p.name}-${uuid()}`);
    const tgz = path.join(tmpDir, "package.tgz");

    const cmds: SpawnWatchCommand[] = [
        {
            cmd: { command: "curl", args: ["--output", tgz, "--silent", "--fail", "--create-dirs", pkgUrl] },
        },
    ];
    const els = cmds.map(spawnExecuteLogger);
    const result = await executeLoggers(els, gi.progressLog);
    if (result.code !== 0) {
        throw new Error(`Failed to download NPM package ${pkgUrl}: ${result.message}`);
    }
    return {
        path: tgz,
        url: pkgUrl,
        version: pkgVersion,
    };
}

/**
 * Download published pre-release NPM package, replace the contents of
 * project with the contents of the package, and set the version to
 * the release version.
 */
export async function npmReleasePreparation(p: GitProject, gi: GoalInvocation): Promise<ExecuteGoalResult> {
    const pkgInfo = await downloadNpmPackage(p, gi);
    const versionRelease = releaseOrPreRelease(pkgInfo.version, gi);
    const tmpDir = path.dirname(pkgInfo.path);
    const cmds: SpawnWatchCommand[] = [
        {
            cmd: { command: "tar", args: ["-x", "-z", "-f", pkgInfo.path] },
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
    return executeLoggers(els, gi.progressLog);
}

export const NpmReleasePreparations: PrepareForGoalExecution[] = [npmReleasePreparation];

export function executeReleaseNpm(
    projectIdentifier: ProjectIdentifier,
    preparations: PrepareForGoalExecution[] = NpmReleasePreparations,
    options?: NpmOptions,
): ExecuteGoal {

    if (!options.npmrc) {
        throw new Error(`No npmrc defined in NPM options`);
    }
    return async (gi: GoalInvocation) => {
        const { configuration, credentials, id, context } = gi;
        return configuration.sdm.projectLoader.doWithProject({
            credentials,
            id,
            context,
            readOnly: false,
        }, async (project: GitProject) => {

            await fs.writeFile(path.join(project.baseDir, ".npmrc"), options.npmrc);

            for (const preparation of preparations) {
                const pResult = await preparation(project, gi);
                if (pResult && pResult.code !== 0) {
                    return pResult;
                }
            }
            const args = [
                "publish",
                "--registry", options.registry,
                "--access", options.access ? options.access : "restricted",
            ];
            const version = await rwlcVersion(gi);
            const versionRelease = releaseOrPreRelease(version, gi);
            if (isNextVersion(versionRelease)) {
                args.push(
                    "--tag", "next",
                );
            }
            const result = await spawnLog(
                "npm",
                args,
                {
                    cwd: project.baseDir,
                    log: gi.progressLog,
                });
            if (result.error) {
                return result;
            }

            const pi = await projectIdentifier(project);
            const url = npmPackageUrl({
                registry: options.registry,
                name: pi.name,
                version: pi.version,
            });
            if (options.status) {
                await github.createStatus(
                    (credentials as TokenCredentials).token,
                    id as GitHubRepoRef,
                    {
                        context: "npm/atomist/package",
                        description: "NPM package",
                        target_url: url,
                        state: "success",
                    });
            }

            const egr: ExecuteGoalResult = {
                code: result.code,
                message: result.message,
                targetUrl: url,
            };
            return egr;
        });
    };
}

export async function dockerReleasePreparation(p: GitProject, gi: GoalInvocation): Promise<ExecuteGoalResult> {
    const version = await rwlcVersion(gi);
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
    return executeLoggers(els, gi.progressLog);
}

export const DockerReleasePreparations: PrepareForGoalExecution[] = [dockerReleasePreparation];

export function executeReleaseDocker(
    preparations: PrepareForGoalExecution[] = DockerReleasePreparations,
    options?: DockerOptions,
): ExecuteGoal {

    return async (gi: GoalInvocation) => {
        const { configuration, credentials, id, context } = gi;
        if (!options.registry) {
            throw new Error(`No registry defined in Docker options`);
        }
        return configuration.sdm.projectLoader.doWithProject({
            credentials,
            id,
            context,
            readOnly: false,
        }, async (project: GitProject) => {

            for (const preparation of preparations) {
                const pResult = await preparation(project, gi);
                if (pResult && pResult.code !== 0) {
                    return pResult;
                }
            }

            const version = await rwlcVersion(gi);
            const versionRelease = releaseOrPreRelease(version, gi);
            const image = dockerImage({
                registry: options.registry,
                name: gi.goalEvent.repo.name,
                version,
            });
            const tag = dockerImage({
                registry: options.registry,
                name: gi.goalEvent.repo.name,
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
            return executeLoggers(els, gi.progressLog);
        });
    };
}

/**
 * Create release semantic version tag and GitHub release for that tag.
 */
export function executeReleaseTag(): ExecuteGoal {
    return async (gi: GoalInvocation): Promise<ExecuteGoalResult> => {
        const { configuration, credentials, id, context } = gi;

        return configuration.sdm.projectLoader.doWithProject({ credentials, id, context, readOnly: true }, async p => {
            const version = await rwlcVersion(gi);
            const versionRelease = releaseOrPreRelease(version, gi);
            if (!(gi.goalEvent.push.after.tags || []).some(t => t.name === versionRelease)) {
                await createTagForStatus(id, gi.goalEvent.sha, gi.goalEvent.push.after.message, versionRelease, credentials);
            }
            const commitTitle = gi.goalEvent.push.after.message.replace(/\n[\S\s]*/, "");
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
            return github.createRelease((credentials as TokenCredentials).token, id as GitHubRepoRef, release)
                .then(() => egr);
        });
    };
}

function typedocDir(baseDir: string): string {
    const oldDir = path.join(baseDir, "build", "typedoc");
    const dir = path.join(baseDir, "doc");
    if (fs.existsSync(oldDir)) {
        return oldDir;
    }
    return dir;
}

export async function docsReleasePreparation(p: GitProject, gi: GoalInvocation): Promise<ExecuteGoalResult> {
    const cmds: SpawnWatchCommand[] = [
        {
            cmd: {
                command: "npm",
                args: ["ci"],
                options: {
                    ...DevelopmentEnvOptions,
                    log: gi.progressLog,
                },
            },
            cwd: p.baseDir,
        },
        {
            cmd: { command: "npm", args: ["run", "compile"] },
            cwd: p.baseDir,
        },
        {
            cmd: { command: "npm", args: ["run", "doc"] },
            cwd: p.baseDir,
        },
    ];
    const els = cmds.map(spawnExecuteLogger);
    return executeLoggers(els, gi.progressLog);
}

export const DocsReleasePreparations: PrepareForGoalExecution[] = [docsReleasePreparation];

/**
 * Publish TypeDoc to gh-pages branch.
 */
export function executeReleaseDocs(
    preparations: PrepareForGoalExecution[] = DocsReleasePreparations,
): ExecuteGoal {

    return async (gi: GoalInvocation) => {
        const { configuration, credentials, id, context } = gi;
        return configuration.sdm.projectLoader.doWithProject({
            credentials,
            id,
            context,
            readOnly: false,
        }, async (project: GitProject) => {

            for (const preparation of preparations) {
                const pResult = await preparation(project, gi);
                if (pResult && pResult.code !== 0) {
                    return pResult;
                }
            }

            const version = await rwlcVersion(gi);
            const versionRelease = releaseOrPreRelease(version, gi);
            const commitMsg = `TypeDoc: publishing for version ${versionRelease}

[atomist:generated]`;
            const docDir = typedocDir(project.baseDir);
            const els = [spawnExecuteLogger({
                cmd: { command: "touch", args: [path.join(docDir, ".nojekyll")] },
                cwd: project.baseDir,
            })];
            const docProject = await NodeFsLocalProject.fromExistingDirectory(project.id, docDir);
            const docGitProject = GitCommandGitProject.fromProject(docProject, credentials) as GitCommandGitProject;
            const targetUrl = `https://${docGitProject.id.owner}.github.io/${docGitProject.id.repo}`;
            const rrr = project.id as RemoteRepoRef;

            els.push(
                gitExecuteLogger(docGitProject, () => docGitProject.init(), "init"),
                gitExecuteLogger(docGitProject, () => docGitProject.commit(commitMsg), "commit"),
                gitExecuteLogger(docGitProject, () => docGitProject.createBranch("gh-pages"), "createBranch"),
                gitExecuteLogger(docGitProject, () => docGitProject.setRemote(rrr.cloneUrl(credentials)), "setRemote"),
                gitExecuteLogger(docGitProject, () => docGitProject.push({ force: true }), "push"),
            );
            const gitRes = await executeLoggers(els, gi.progressLog);
            if (gitRes.code !== 0) {
                return gitRes;
            }
            return { ...Success, targetUrl };
        });
    };
}

/**
 * Increment patch level in project version.
 */
export function executeReleaseVersion(
    projectIdentifier: ProjectIdentifier,
    incrementPatchCmd: SpawnLogCommand = { command: "npm", args: ["version", "--no-git-tag-version", "patch"] },
): ExecuteGoal {

    return async (gi: GoalInvocation): Promise<ExecuteGoalResult> => {
        const { configuration, credentials, id, context } = gi;

        return configuration.sdm.projectLoader.doWithProject({ credentials, id, context, readOnly: false }, async p => {
            const version = await rwlcVersion(gi);
            const versionRelease = releaseOrPreRelease(version, gi);
            const gp = p as GitCommandGitProject;

            const log = new DelimitedWriteProgressLogDecorator(gi.progressLog, "\n");
            const slug = `${gp.id.owner}/${gp.id.repo}`;
            const branch = gi.goalEvent.branch;
            const remote = gp.remote || "origin";
            const preEls: ExecuteLogger[] = [
                gitExecuteLogger(gp, () => gp.checkout(branch), "checkout"),
                spawnExecuteLogger({ cmd: { command: "git", args: ["pull", remote, branch] }, cwd: gp.baseDir }),
            ];
            await loglog(log, `Pulling ${branch} of ${slug}`);
            const preRes = await executeLoggers(preEls, gi.progressLog);
            if (preRes.code !== 0) {
                return preRes;
            }
            gp.branch = branch;

            const pi = await projectIdentifier(p);
            if (pi.version !== versionRelease) {
                const message = `current master version (${pi.version}) seems to have already been ` +
                    `incremented after ${releaseVersion} release`;
                await loglog(log, message);
                return { ...Success, message };
            }

            const postEls: ExecuteLogger[] = [
                spawnExecuteLogger({ cmd: incrementPatchCmd, cwd: gp.baseDir }),
                gitExecuteLogger(gp, () => gp.commit(`Version: increment after ${versionRelease} release

[atomist:generated]`), "commit"),
                gitExecuteLogger(gp, () => gp.push(), "push"),
            ];
            await loglog(log, `Incrementing version and committing for ${slug}`);
            return executeLoggers(postEls, gi.progressLog);
        });
    };
}

export const IsReleaseCommit: PushTest = {
    name: "IsReleaseCommit",
    mapping: async pi => {
        const versionRegexp = /Version: increment after .* release/i;
        const changelogRegexp = /Changelog: add release .*/i;
        return versionRegexp.test(pi.push.after.message) || changelogRegexp.test(pi.push.after.message);
    },
};
