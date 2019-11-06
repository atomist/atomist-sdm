/*
 * Copyright © 2019 Atomist, Inc.
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

import {
    GitCommandGitProject,
    GitHubRepoRef,
    GitProject,
    logger,
    RemoteRepoRef,
    Success,
    TokenCredentials,
} from "@atomist/automation-client";
import {
    DelimitedWriteProgressLogDecorator,
    ExecuteGoal,
    ExecuteGoalResult,
    formatDate,
    GoalInvocation,
    ProgressLog,
    PushTest,
    SdmGoalEvent,
} from "@atomist/sdm";
import {
    createGitTag,
    github,
    ProjectIdentifier,
    readSdmVersion,
} from "@atomist/sdm-core";
import * as semver from "semver";
import {
    ExecuteLogger,
    executeLoggers,
    gitExecuteLogger,
    spawnExecuteLogger,
} from "../support/executeLogger";

async function loglog(log: ProgressLog, msg: string): Promise<void> {
    logger.debug(msg);
    log.write(`${msg}\n`);
    await log.flush();
}

export interface ProjectRegistryInfo {
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
    const tags = gi.goalEvent.push?.after?.tags || [];
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

/**
 * Make a release version a branch-aware pre-release version.
 */
export function addBranchPreRelease(baseVersion: string, goalEvent: SdmGoalEvent): string {
    const branch = goalEvent.branch;
    const branchSuffix = (branch === goalEvent.push.repo.defaultBranch) ? "" :
        "branch-" + branch.replace(/[_/]/g, "-") + ".";
    const ts = formatDate();
    const prereleaseVersion = `${baseVersion}-${branchSuffix}${ts}`;
    return prereleaseVersion;
}

export function isNextVersion(version: string): boolean {
    const preRelease = semver.prerelease(version);
    return (preRelease && ["M", "RC"].includes(preRelease[0]));
}

function releaseVersion(version: string): string {
    return version.replace(/-.*/, "");
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
                await createGitTag({ project: p, message: gi.goalEvent.push.after.message, tag: versionRelease, log: gi.progressLog });
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

export type IncrementPatchCommand = (p: GitProject, log: ProgressLog) => Promise<ExecuteGoalResult>;

/**
 * Increment patch level in project version.
 */
export function executeReleaseVersion(projectIdentifier: ProjectIdentifier, incrementPatchCmd: IncrementPatchCommand): ExecuteGoal {

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

            const incrementPatchResult = await incrementPatchCmd(gp, log);
            if (incrementPatchResult.code !== 0) {
                return incrementPatchResult;
            }

            const postEls: ExecuteLogger[] = [
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
