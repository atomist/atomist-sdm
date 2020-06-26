/*
 * Copyright © 2020 Atomist, Inc.
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

/* tslint:disable:max-file-line-count */

import {
    configurationValue,
    GitCommandGitProject,
    GitHubRepoRef,
    GitProject,
    guid,
    logger,
    NodeFsLocalProject,
    RemoteRepoRef,
    Success,
    TokenCredentials,
} from "@atomist/automation-client";
import {
    allSatisfied,
    ExecuteGoal,
    ExecuteGoalResult,
    GoalInvocation,
    GoalProjectListenerEvent,
    LogSuppressor,
    not,
    PrepareForGoalExecution,
    ProgressLog,
    projectConfigurationValue,
    SdmGoalState,
    SoftwareDeliveryMachine,
    spawnLog,
} from "@atomist/sdm";
import { github, ProjectIdentifier } from "@atomist/sdm-core";
import { DockerOptions, HasDockerfile } from "@atomist/sdm-pack-docker";
import {
    AddThirdPartyLicenseAutofix,
    DevelopmentEnvOptions,
    executePublish,
    IsNode,
    nodeBuilder,
    NodeProjectIdentifier,
    NodeProjectVersioner,
    NpmNodeModulesCachePut,
    NpmNodeModulesCacheRestore,
    NpmOptions,
    NpmProgressReporter,
    NpmVersionProjectListener,
    PackageLockUrlRewriteAutofix,
    TypeScriptCompileCachePut,
    TypeScriptCompileCacheRestore,
} from "@atomist/sdm-pack-node";
import { IsMaven } from "@atomist/sdm-pack-spring";
import * as fs from "fs-extra";
import * as path from "path";
import { RenameTest, RenameTestFix } from "../autofix/test/testNamingFix";
import { deleteDistTagOnBranchDeletion } from "../event/deleteDistTagOnBranchDeletion";
import { executeLoggers, gitExecuteLogger, spawnExecuteLogger, SpawnWatchCommand } from "../support/executeLogger";
import { transformToProjectListener } from "../support/transformToProjectListener";
import { SourcesTransform } from "../transform/sourcesTransform";
import { UpdatePackageAuthor } from "../transform/updatePackageAuthor";
import {
    autofix,
    build,
    dockerBuild,
    publish,
    publishWithApproval,
    release,
    releaseDocs,
    releaseVersion,
    version,
} from "./goals";
import { executeReleaseVersion, isNextVersion, ProjectRegistryInfo, releaseOrPreRelease, rwlcVersion } from "./release";

const NodeDefaultOptions = {
    pushTest: allSatisfied(IsNode, not(IsMaven)),
    logInterpreter: LogSuppressor,
    progressReporter: NpmProgressReporter,
};

/**
 * Add Node.js implementations of goals to SDM.
 *
 * @param sdm Software Delivery machine to modify
 * @return modified software delivery machine
 */
export function addNodeSupport(sdm: SoftwareDeliveryMachine): SoftwareDeliveryMachine {
    version.with({
        ...NodeDefaultOptions,
        name: "npm-versioner",
        versioner: NodeProjectVersioner,
        pushTest: IsNode,
    });

    autofix
        .with(PackageLockUrlRewriteAutofix)
        .with(RenameTestFix)
        .with(AddThirdPartyLicenseAutofix)
        .withProjectListener(NpmNodeModulesCacheRestore)
        .withProjectListener({
            // something is cleaning out the node_modules folder -> cache it early
            ...NpmNodeModulesCachePut,
            events: [GoalProjectListenerEvent.before],
        });

    build
        .with({
            ...NodeDefaultOptions,
            name: "npm-run-build",
            // tslint:disable-next-line:deprecation
            builder: nodeBuilder({ command: "npm", args: ["run", "compile"] }, { command: "npm", args: ["test"] }),
            pushTest: NodeDefaultOptions.pushTest,
        })
        .withProjectListener(NpmNodeModulesCacheRestore)
        .withProjectListener(TypeScriptCompileCachePut);

    publish
        .with({
            ...NodeDefaultOptions,
            name: "npm-publish",
            goalExecutor: executePublish(NodeProjectIdentifier, sdm.configuration.sdm.npm as NpmOptions),
        })
        .withProjectListener(NpmNodeModulesCacheRestore)
        .withProjectListener(NpmVersionProjectListener)
        .withProjectListener(TypeScriptCompileCacheRestore)
        .withProjectListener(transformToProjectListener(SourcesTransform, "package sources"));

    publishWithApproval
        .with({
            ...NodeDefaultOptions,
            name: "npm-publish",
            goalExecutor: executePublish(NodeProjectIdentifier, sdm.configuration.sdm.npm as NpmOptions),
        })
        .withProjectListener(NpmNodeModulesCacheRestore)
        .withProjectListener(NpmVersionProjectListener)
        .withProjectListener(TypeScriptCompileCacheRestore)
        .withProjectListener(transformToProjectListener(SourcesTransform, "package sources"));

    dockerBuild
        .with({
            ...NodeDefaultOptions,
            name: "npm-docker-build",
            options: {
                ...(sdm.configuration.sdm.docker.hub as DockerOptions),
                push: true,
                builder: "docker",
            },
            pushTest: allSatisfied(IsNode, HasDockerfile),
        })
        .withProjectListener(NpmNodeModulesCacheRestore)
        .withProjectListener(NpmVersionProjectListener)
        .withProjectListener(TypeScriptCompileCacheRestore);

    release.with({
        ...NodeDefaultOptions,
        name: "npm-release",
        goalExecutor: executeReleaseNpm(
            NodeProjectIdentifier,
            NpmReleasePreparations,
            sdm.configuration.sdm.npm as NpmOptions,
        ),
    });

    releaseDocs.with({
        ...NodeDefaultOptions,
        name: "npm-docs-release",
        goalExecutor: executeReleaseTypeDocs(DocsReleasePreparations),
    });

    releaseVersion.with({
        ...NodeDefaultOptions,
        name: "npm-release-version",
        goalExecutor: executeReleaseVersion(NodeProjectIdentifier, npmIncrementPatch),
    });

    sdm.addEvent(
        deleteDistTagOnBranchDeletion(sdm.configuration.sdm.projectLoader, sdm.configuration.sdm.npm as NpmOptions),
    );

    sdm.addCodeTransformCommand(UpdatePackageAuthor).addCodeTransformCommand(RenameTest);

    return sdm;
}

/**
 * Increment the patch version of a Node project managed by NPM.
 */
async function npmIncrementPatch(p: GitProject, log: ProgressLog): Promise<ExecuteGoalResult> {
    return spawnLog("npm", ["version", "--no-git-tag-version", "patch"], { cwd: p.baseDir, log });
}

function npmPackageUrl(p: ProjectRegistryInfo): string {
    return `${p.registry}/${p.name}/-/${p.name}-${p.version}.tgz`;
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
export async function downloadNpmPackage(p: GitProject, gi: GoalInvocation, v?: string): Promise<NpmPackageInfo> {
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
    const pkgVersion = v ? v : await rwlcVersion(gi);
    const npmOptions = configurationValue<NpmOptions>("sdm.npm");
    if (!npmOptions.registry) {
        throw new Error(`No NPM registry defined in NPM options`);
    }
    const pkgUrl = npmPackageUrl({
        registry: npmOptions.registry,
        name: pj.name,
        version: pkgVersion,
    });
    const tmpDir = path.join(process.env.TMPDIR || "/tmp", `${p.name}-${guid()}`);
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
        return configuration.sdm.projectLoader.doWithProject(
            {
                credentials,
                id,
                context,
                readOnly: false,
            },
            async (project: GitProject) => {
                if (!(await projectConfigurationValue<boolean>("npm.publish.enabled", project, true))) {
                    return {
                        code: 0,
                        description: "Publish disabled",
                        state: SdmGoalState.success,
                    };
                }

                await fs.writeFile(path.join(project.baseDir, ".npmrc"), options.npmrc);

                for (const preparation of preparations) {
                    const pResult = await preparation(project, gi);
                    if (pResult && pResult.code !== 0) {
                        return pResult;
                    }
                }
                const args = [
                    "publish",
                    "--registry",
                    options.registry,
                    "--access",
                    options.access ? options.access : "restricted",
                ];
                const v = await rwlcVersion(gi);
                const versionRelease = releaseOrPreRelease(v, gi);
                if (isNextVersion(versionRelease)) {
                    args.push("--tag", "next");
                }
                const result = await spawnLog("npm", args, {
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
                    await github.createStatus((credentials as TokenCredentials).token, id as GitHubRepoRef, {
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
            },
        );
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
export function executeReleaseTypeDocs(preparations: PrepareForGoalExecution[] = DocsReleasePreparations): ExecuteGoal {
    return async (gi: GoalInvocation) => {
        const { configuration, credentials, id, context } = gi;
        return configuration.sdm.projectLoader.doWithProject(
            {
                credentials,
                id,
                context,
                readOnly: false,
            },
            async (project: GitProject) => {
                for (const preparation of preparations) {
                    const pResult = await preparation(project, gi);
                    if (pResult && pResult.code !== 0) {
                        return pResult;
                    }
                }

                const v = await rwlcVersion(gi);
                const versionRelease = releaseOrPreRelease(v, gi);
                const commitMsg = `TypeDoc: publishing for version ${versionRelease}

[atomist:generated]`;
                const docDir = typedocDir(project.baseDir);
                const els = [
                    spawnExecuteLogger({
                        cmd: { command: "touch", args: [path.join(docDir, ".nojekyll")] },
                        cwd: project.baseDir,
                    }),
                ];
                const docProject = await NodeFsLocalProject.fromExistingDirectory(project.id, docDir);
                const docGitProject = GitCommandGitProject.fromProject(docProject, credentials) as GitCommandGitProject;
                const targetUrl = `https://${docGitProject.id.owner}.github.io/${docGitProject.id.repo}`;
                const rrr = project.id as RemoteRepoRef;

                els.push(
                    gitExecuteLogger(docGitProject, () => docGitProject.init(), "init"),
                    gitExecuteLogger(docGitProject, () => docGitProject.commit(commitMsg), "commit"),
                    gitExecuteLogger(docGitProject, () => docGitProject.createBranch("gh-pages"), "createBranch"),
                    gitExecuteLogger(
                        docGitProject,
                        () => docGitProject.setRemote(rrr.cloneUrl(credentials)),
                        "setRemote",
                    ),
                    gitExecuteLogger(docGitProject, () => docGitProject.push({ force: true }), "push"),
                );
                const gitRes = await executeLoggers(els, gi.progressLog);
                if (gitRes.code !== 0) {
                    return gitRes;
                }
                return { ...Success, targetUrl };
            },
        );
    };
}
