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
    allSatisfied,
    anySatisfied,
    formatDate,
    LogSuppressor,
    not,
    SoftwareDeliveryMachine,
} from "@atomist/sdm";
import { ProjectIdentifier } from "@atomist/sdm-core";
import {
    DockerOptions,
    HasDockerfile,
} from "@atomist/sdm-pack-docker";
import { IsNode } from "@atomist/sdm-pack-node";
import { IsMaven } from "@atomist/sdm-pack-spring";
import {
    isNamed,
    isOrgNamed,
} from "../support/identityPushTests";
import {
    dockerBuild,
    releaseDocker,
    releaseVersion,
    version,
} from "./goals";
import {
    executeReleaseDocker,
    executeReleaseVersion,
} from "./release";

/**
 * Add Docker implementations of goals to SDM.
 *
 * @param sdm Software Delivery machine to modify
 * @return modified software delivery machine
 */
export function addDockerSupport(sdm: SoftwareDeliveryMachine): SoftwareDeliveryMachine {

    const simpleDockerPushTest = allSatisfied(HasDockerfile, not(IsNode), not(IsMaven), isOrgNamed("atomist"));

    version.with({
        name: "file-versioner",
        versioner: async (sdmGoal, p, log) => {
            const baseVersion: string = (await fileProjectIdentifier(p)).version;
            log.write(`Using base version '${baseVersion}'`);
            const branch = sdmGoal.branch;
            const branchSuffix = (branch === sdmGoal.push.repo.defaultBranch) ? "" :
                "branch-" + branch.replace(/[_/]/g, "-") + ".";
            log.write(`Commit is on branch '${branch}', using '${branchSuffix}'`);
            const ts = formatDate();
            log.write(`Current timestamp is '${ts}'`);
            const prereleaseVersion = `${baseVersion}-${branchSuffix}${ts}`;
            log.write(`Calculated pre-release version '${prereleaseVersion}'`);
            return prereleaseVersion;
        },
        logInterpreter: LogSuppressor,
        pushTest: simpleDockerPushTest,
    });

    dockerBuild.with({
        name: "simple-docker-build",
        options: {
            ...sdm.configuration.sdm.docker.hub as DockerOptions,
            push: true,
            builder: "docker",
        },
        logInterpreter: LogSuppressor,
        pushTest: simpleDockerPushTest,
    });

    releaseDocker
        .with({
            name: "docker-release-global-sdm",
            goalExecutor: executeReleaseDocker(sdm.configuration.sdm.docker.t095sffbk as DockerOptions),
            pushTest: allSatisfied(IsNode, HasDockerfile, allSatisfied(isOrgNamed("atomisthq"), isNamed("global-sdm"))),
            logInterpreter: LogSuppressor,
        })
        .with({
            name: "docker-release",
            goalExecutor: executeReleaseDocker(sdm.configuration.sdm.docker.hub as DockerOptions),
            pushTest: allSatisfied(anySatisfied(IsNode, IsMaven), HasDockerfile, not(allSatisfied(isOrgNamed("atomisthq"), isNamed("global-sdm")))),
            logInterpreter: LogSuppressor,
        })
        .with({
            name: "simple-docker-release",
            goalExecutor: executeReleaseDocker(sdm.configuration.sdm.docker.hub as DockerOptions),
            pushTest: simpleDockerPushTest,
            logInterpreter: LogSuppressor,
        });

    releaseVersion.with({
        name: "file-release-version",
        goalExecutor: executeReleaseVersion(fileProjectIdentifier,
            // tslint:disable-next-line:no-invalid-template-strings
            { command: "bash", args: ["-c", 'if [[ -f VERSION ]];then v=$(<VERSION);p=${v##*.};echo "${v%.*}.$((++p))" >VERSION;fi'] }),
        logInterpreter: LogSuppressor,
        pushTest: simpleDockerPushTest,
    });

    return sdm;
}

const fileProjectIdentifier: ProjectIdentifier = async p => {
    const versionFile = await p.getFile("VERSION");
    const versionContents = (versionFile) ? await versionFile.getContent() : "0.0.0";
    const v = versionContents.trim();
    return { name: p.name, version: v };
};
