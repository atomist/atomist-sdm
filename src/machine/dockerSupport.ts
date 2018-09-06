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

import { HasDockerfile } from "@atomist/sdm-pack-docker/docker/dockerPushTests";
import { DockerOptions } from "@atomist/sdm-pack-docker/docker/executeDockerBuild";
import { LogSuppressor } from "@atomist/sdm/api-helper/log/logInterpreters";
import { SoftwareDeliveryMachine } from "@atomist/sdm/api/machine/SoftwareDeliveryMachine";
import { ReleaseDockerGoal } from "./goals";
import { DockerReleasePreparations, executeReleaseDocker } from "./release";

/**
 * Add Docker implementations of goals to SDM.
 *
 * @param sdm Software Delivery machine to modify
 * @return modified software delivery machine
 */
export function addDockerSupport(sdm: SoftwareDeliveryMachine): SoftwareDeliveryMachine {

    ReleaseDockerGoal.with({
        name: "docker-release",
        goalExecutor: executeReleaseDocker(
            DockerReleasePreparations,
            sdm.configuration.sdm.docker.hub as DockerOptions),
        pushTest: HasDockerfile,
        logInterpreter: LogSuppressor,
    });

    return sdm;
}
