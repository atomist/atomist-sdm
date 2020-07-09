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

import { ExecuteGoalResult, LogSuppressor, ProgressLog, SoftwareDeliveryMachine, spawnLog } from "@atomist/sdm";
import { GitProject } from "@atomist/sdm/lib/client";
import { DefaultDockerImageNameCreator, DockerRegistry } from "@atomist/sdm/lib/pack/docker";
import {
    IsMaven,
    MavenProjectIdentifier,
    MavenProjectVersioner,
    MvnPackage,
    MvnVersion,
} from "@atomist/sdm/lib/pack/jvm";
import { executeGoalCommandsInProject } from "../support/executeGoal";
import { build, dockerBuild, noOpGoalExecutor, publish, release, releaseDocs, releaseVersion, version } from "./goals";
import { executeReleaseVersion } from "./release";

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
    build.with({
        ...MavenDefaultOptions,
        name: "mvn-package",
        goalExecutor: executeGoalCommandsInProject([
            { command: "mvn", args: ["-Dskip.npm", "-Dskip.webpack", "package"] },
        ]),
    });

    version.with({
        ...MavenDefaultOptions,
        name: "mvn-versioner",
        versioner: MavenProjectVersioner,
    });

    dockerBuild
        .with({
            ...MavenDefaultOptions,
            name: "mvn-docker-build",
            dockerImageNameCreator: DefaultDockerImageNameCreator,
            registry: sdm.configuration.sdm.docker.hub as DockerRegistry,
            push: true,
            builder: "docker",
        })
        .withProjectListener(MvnVersion)
        .withProjectListener(MvnPackage);

    releaseVersion.with({
        ...MavenDefaultOptions,
        name: "mvn-release-version",
        goalExecutor: executeReleaseVersion(MavenProjectIdentifier, mvnIncrementPatch),
    });

    publish.with({
        ...MavenDefaultOptions,
        name: "mvn-publish",
        goalExecutor: noOpGoalExecutor,
    });

    releaseDocs.with({
        ...MavenDefaultOptions,
        name: "mvn-docs-release",
        goalExecutor: noOpGoalExecutor,
    });

    // No need to release npm for a Maven project. Maybe make this a more generic goal.
    release.with({
        ...MavenDefaultOptions,
        name: "mvn-release",
        goalExecutor: noOpGoalExecutor,
    });

    return sdm;
}

/**
 * Increment the patch version of a JVM project managed by Maven.
 */
async function mvnIncrementPatch(p: GitProject, log: ProgressLog): Promise<ExecuteGoalResult> {
    const args = [
        "build-helper:parse-version",
        "versions:set",
        // tslint:disable-next-line:max-line-length no-invalid-template-strings
        "-DnewVersion=${parsedVersion.majorVersion}.${parsedVersion.minorVersion}.${parsedVersion.nextIncrementalVersion}-${parsedVersion.qualifier}",
        "versions:commit",
    ];
    return spawnLog("./mvnw", args, { cwd: p.baseDir, log });
}
