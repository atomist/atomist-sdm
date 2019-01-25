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

import {
    allSatisfied,
    LogSuppressor,
    not,
    SoftwareDeliveryMachine,
} from "@atomist/sdm";
import {
    DockerOptions,
    HasDockerfile,
} from "@atomist/sdm-pack-docker";
import { IsNode } from "@atomist/sdm-pack-node";
import {
    isNamed,
    isOrgNamed,
} from "../support/identityPushTests";
import { releaseDocker } from "./goals";
import { executeReleaseDocker } from "./release";

/**
 * Add Docker implementations of goals to SDM.
 *
 * @param sdm Software Delivery machine to modify
 * @return modified software delivery machine
 */
export function addDockerSupport(sdm: SoftwareDeliveryMachine): SoftwareDeliveryMachine {

    releaseDocker
        .with({
            name: "docker-release-global-sdm",
            goalExecutor: executeReleaseDocker(
                sdm.configuration.sdm.docker.t095sffbk as DockerOptions),
            pushTest: allSatisfied(IsNode, HasDockerfile, allSatisfied(isOrgNamed("atomisthq"), isNamed("global-sdm"))),
            logInterpreter: LogSuppressor,
        }).with({
        name: "docker-release",
        goalExecutor: executeReleaseDocker(
            sdm.configuration.sdm.docker.hub as DockerOptions),
        pushTest: allSatisfied(IsNode, HasDockerfile, not(allSatisfied(isOrgNamed("atomisthq"), isNamed("global-sdm")))),
        logInterpreter: LogSuppressor,
    });

    return sdm;
}
