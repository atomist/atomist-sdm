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

import { configureLogzio } from "@atomist/automation-client-ext-logzio";
import { configureRaven } from "@atomist/automation-client-ext-raven";
import {
    CacheConfiguration,
    SoftwareDeliveryMachineConfiguration,
} from "@atomist/sdm";
import {
    ConfigureOptions,
    configureSdm,
} from "@atomist/sdm-core";
import { K8sConfiguration } from "@atomist/sdm-pack-k8s";
import { NodeConfiguration } from "@atomist/sdm-pack-node/lib/nodeSupport";
import { machine } from "./lib/machine/machine";

const machineOptions: ConfigureOptions = {
    requiredConfigurationValues: [
        "sdm.npm.npmrc",
        "sdm.npm.registry",
        "sdm.npm.access",
        "sdm.docker.hub.registry",
        "sdm.docker.hub.user",
        "sdm.docker.hub.password",
    ],
};

export const configuration: SoftwareDeliveryMachineConfiguration<K8sConfiguration
    & CacheConfiguration
    & NodeConfiguration> = {
    postProcessors: [
        configureLogzio,
        configureRaven,
        configureSdm(machine, machineOptions),
    ],
    sdm: {
        npm: {
            publish: {
                tag: {
                    defaultBranch: true,
                },
            },
        },
        k8s: {
        },
        cache: {
            enabled: true,
            path: "/opt/data",
        },
    },
};
