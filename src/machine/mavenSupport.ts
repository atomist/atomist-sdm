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

import { executeBuild } from "@atomist/sdm/api-helper/goal/executeBuild";
import { LogSuppressor } from "@atomist/sdm/api-helper/log/logInterpreters";

import {
    ReleaseVersionGoal,
} from "./goals";
import {
    executeReleaseVersion,
} from "./release";

import {GitProject} from "@atomist/automation-client/project/git/GitProject";
import {asSpawnCommand} from "@atomist/automation-client/util/spawned";
import {executeVersioner, ProjectVersioner} from "@atomist/sdm-core/internal/delivery/build/local/projectVersioner";
import {
    DefaultDockerImageNameCreator, DockerOptions,
    executeDockerBuild,
} from "@atomist/sdm-core/pack/docker/executeDockerBuild";
import {DockerBuildGoal, VersionGoal} from "@atomist/sdm-core/pack/well-known-goals/commonGoals";
import {MavenBuilder} from "@atomist/sdm-pack-spring";
import {MavenProjectIdentifier} from "@atomist/sdm-pack-spring/lib/maven/parse/pomParser";
import {IsMaven} from "@atomist/sdm-pack-spring/lib/maven/pushTests";
import {spawnAndWatch} from "@atomist/sdm/api-helper/misc/spawned";
import {ExecuteGoalResult} from "@atomist/sdm/api/goal/ExecuteGoalResult";
import {GoalInvocation} from "@atomist/sdm/api/goal/GoalInvocation";
import {SoftwareDeliveryMachine} from "@atomist/sdm/api/machine/SoftwareDeliveryMachine";
import {BuildGoal} from "@atomist/sdm/api/machine/wellKnownGoals";

import {ProgressLog} from "@atomist/sdm/spi/log/ProgressLog";
import * as df from "dateformat";

const MavenDefaultOptions = {
    pushTest: IsMaven,
    logInterpreter: LogSuppressor,
};

/**
 * Add Maven implementations of goals to SDM.
 *
 * @param sdm Software Delivery machine to modify
 * @return modified software delivery machine
 */
export function addMavenSupport(sdm: SoftwareDeliveryMachine): SoftwareDeliveryMachine {

    sdm.addGoalImplementation(
            "mvn package",
            BuildGoal,
            executeBuild(sdm.configuration.sdm.projectLoader, new MavenBuilder(sdm)),
            MavenDefaultOptions,
    ).addGoalImplementation(
            "mavenVersioner",
            VersionGoal,
            executeVersioner(sdm.configuration.sdm.projectLoader, MavenProjectVersioner),
        MavenDefaultOptions,
    ).addGoalImplementation(
            "mavenDockerBuild",
            DockerBuildGoal,
            executeDockerBuild(
                sdm.configuration.sdm.projectLoader,
                DefaultDockerImageNameCreator,
                [mavenVersionPreparation, mavenCompilePreparation],
                {
                    ...sdm.configuration.sdm.docker.hub as DockerOptions,
                    dockerfileFinder: async () => "Dockerfile",
                }),
            MavenDefaultOptions,
    ).addGoalImplementation(
            "mavenVersionRelease",
            ReleaseVersionGoal,
            executeReleaseVersion(sdm.configuration.sdm.projectLoader, MavenProjectIdentifier, mavenIncrementPatchCmd),
            MavenDefaultOptions,
    );
    return sdm;
}

async function newVersion(sdmGoal, p): Promise<string> {
    const pi = await MavenProjectIdentifier(p);
    const branch = sdmGoal.branch.split("/").join(".");
    const branchSuffix = branch !== sdmGoal.push.repo.defaultBranch ? `${branch}.` : "";
    return `${pi.version}-${branchSuffix}${df(new Date(), "yyyymmddHHMMss")}`;
}

export const MavenProjectVersioner: ProjectVersioner = async (sdmGoal, p, log) => {
    const version = await newVersion(sdmGoal, p);
    await changeMavenVersion(version, p.baseDir, log);
    return version;
};

export async function mavenVersionPreparation(p: GitProject, goalInvocation: GoalInvocation): Promise<ExecuteGoalResult> {
    const version = await newVersion(goalInvocation.sdmGoal, p);
    return changeMavenVersion(version, p.baseDir, goalInvocation.progressLog);
}

async function changeMavenVersion(version: string, baseDir: string, progressLog: ProgressLog): Promise<ExecuteGoalResult> {
    const cmd = `mvn build-helper:parse-version versions:set -DnewVersion="${version} versions:commit"`;
    return spawnAndWatch(
        asSpawnCommand(cmd),
        {
            cwd: baseDir,
        },
        progressLog,
        {
            errorFinder: (code, signal, l) => l.log.includes("[ERROR]"),
        });
}

const mavenIncrementPatchCmd = asSpawnCommand("mvn build-helper:parse-version versions:set -DnewVersion=" +
    "\${parsedVersion.majorVersion}.\${parsedVersion.minorVersion}.\${parsedVersion.nextIncrementalVersion}" +
    "-\${parsedVersion.qualifier} versions:commit");

export async function mavenCompilePreparation(p: GitProject, goalInvocation: GoalInvocation): Promise<ExecuteGoalResult> {
    const cmd = "mvn package -DskipTests";
    return spawnAndWatch(
        asSpawnCommand(cmd),
        {
            cwd: p.baseDir,
        },
        goalInvocation.progressLog,
        {
            errorFinder: (code, signal, l) => l.log.includes("[ERROR]"),
        });
}
