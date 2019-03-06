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

import { Success } from "@atomist/automation-client";
import {
    GoalInvocation,
    LogSuppressor,
    SoftwareDeliveryMachine,
} from "@atomist/sdm";
import {
    DefaultDockerImageNameCreator,
    DockerOptions,
} from "@atomist/sdm-pack-docker";
import {
    IsMaven,
    mavenBuilder,
    MavenProjectIdentifier,
    MavenProjectVersioner,
    MvnPackage,
    MvnVersion,
} from "@atomist/sdm-pack-spring";
import {
    build,
    dockerBuild,
    publish,
    releaseDocs,
    releaseNpm,
    releaseVersion,
    version,
} from "./goals";
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
        builder: mavenBuilder([{ name: "skip.npm" }, { name: "skip.webpack" }]),
    });

    version.with({
        ...MavenDefaultOptions,
        name: "mvn-versioner",
        versioner: MavenProjectVersioner,

    });

    dockerBuild.with({
            ...MavenDefaultOptions,
            name: "mvn-docker-build",
            imageNameCreator: DefaultDockerImageNameCreator,
            options: {
                ...sdm.configuration.sdm.docker.hub as DockerOptions,
                push: true,
                builder: "docker",
            },
        })
        .withProjectListener(MvnVersion)
        .withProjectListener(MvnPackage);

    releaseVersion.with({
        ...MavenDefaultOptions,
        name: "mvn-release-version",
        goalExecutor: executeReleaseVersion(
            MavenProjectIdentifier,
            {
                command: "./mvnw",
                args: ["build-helper:parse-version", "versions:set", "-DnewVersion=" +
                "\${parsedVersion.majorVersion}.\${parsedVersion.minorVersion}.\${parsedVersion.nextIncrementalVersion}-" +
                "\${parsedVersion.qualifier}", "versions:commit"],
        }),
    });

    publish.with({
        ...MavenDefaultOptions,
        name: "mvn-publish",
        goalExecutor: (r: GoalInvocation) => Promise.resolve(Success),
    });

    releaseDocs.with({
        ...MavenDefaultOptions,
        name: "mvn-docs-release",
        goalExecutor: (r: GoalInvocation) => Promise.resolve(Success),
    });

    // No need to release npm for a Maven project. Maybe make this a more generic goal.
    releaseNpm.with({
        ...MavenDefaultOptions,
        name: "mvn-release",
        goalExecutor: (r: GoalInvocation) => Promise.resolve(Success),
    });

    return sdm;
}
