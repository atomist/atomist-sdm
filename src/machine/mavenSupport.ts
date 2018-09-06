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

import { Success } from "@atomist/automation-client/HandlerResult";
import { GitProject } from "@atomist/automation-client/project/git/GitProject";
import { asSpawnCommand } from "@atomist/automation-client/util/spawned";
import { ProjectVersioner } from "@atomist/sdm-core/internal/delivery/build/local/projectVersioner";
import {
    DefaultDockerImageNameCreator, DockerOptions,
} from "@atomist/sdm-pack-docker/docker/executeDockerBuild";
import { MavenProjectIdentifier } from "@atomist/sdm-pack-spring/lib/maven/parse/pomParser";
import { IsMaven } from "@atomist/sdm-pack-spring/lib/maven/pushTests";
import { LogSuppressor } from "@atomist/sdm/api-helper/log/logInterpreters";
import { spawnAndWatch } from "@atomist/sdm/api-helper/misc/spawned";
import { ExecuteGoalResult } from "@atomist/sdm/api/goal/ExecuteGoalResult";
import { GoalInvocation } from "@atomist/sdm/api/goal/GoalInvocation";
import { SoftwareDeliveryMachine } from "@atomist/sdm/api/machine/SoftwareDeliveryMachine";
import { ProgressLog } from "@atomist/sdm/spi/log/ProgressLog";
import * as df from "dateformat";
import { MavenBuilder, mavenPackage } from "../maven/MavenBuilder";
import {
    BuildGoal,
    DockerBuildGoal, PublishGoal,
    ReleaseVersionGoal,
    VersionGoal,
} from "./goals";
import {
    executeReleaseVersion,
} from "./release";

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

    BuildGoal.with({
        ...MavenDefaultOptions,
        name: "mvn-package",
        builder: new MavenBuilder(sdm),
    });

    VersionGoal.with({
        ...MavenDefaultOptions,
        name: "mvn-versioner",
        versioner: MavenProjectVersioner,

    });

    DockerBuildGoal.with({
        ...MavenDefaultOptions,
        name: "mvn-docker-build",
        preparations: [mavenVersionPreparation, mavenCompilePreparation],
        imageNameCreator: DefaultDockerImageNameCreator,
        options: sdm.configuration.sdm.docker.hub as DockerOptions,
    });

    ReleaseVersionGoal.with({
        ...MavenDefaultOptions,
        name: "mvn-release-version",
        goalExecutor: executeReleaseVersion(MavenProjectIdentifier, mavenIncrementPatchCmd),
    });

    PublishGoal.with({
        ...MavenDefaultOptions,
        name: "mvn-publish",
        goalExecutor: () =>  Success,
    });

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
    const cmd = `./mvnw build-helper:parse-version versions:set -DnewVersion="${version}" versions:commit`;
    return spawnAndWatch(
        asSpawnCommand(cmd),
        {
            cwd: baseDir,
        },
        progressLog);
}

const mavenIncrementPatchCmd = asSpawnCommand("./mvnw build-helper:parse-version versions:set -DnewVersion=" +
    "\${parsedVersion.majorVersion}.\${parsedVersion.minorVersion}.\${parsedVersion.nextIncrementalVersion}" +
    "-\${parsedVersion.qualifier} versions:commit");

export async function mavenCompilePreparation(p: GitProject, goalInvocation: GoalInvocation): Promise<ExecuteGoalResult> {
    return mavenPackage(p, goalInvocation.progressLog, true);
}
