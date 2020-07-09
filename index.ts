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

import { Configuration } from "@atomist/sdm/lib/client";
import { CompressingGoalCache, ConfigureOptions, configureSdm } from "@atomist/sdm/lib/core";
import { GoogleCloudStorageGoalCacheArchiveStore } from "@atomist/sdm/lib/pack/gcp/cache";
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

export const configuration: Configuration = {
    postProcessors: [configureSdm(machine, machineOptions)],
    sdm: {
        npm: {
            publish: {
                tag: {
                    defaultBranch: true,
                },
            },
        },
        k8s: {
            job: {
                cleanupInterval: 1000 * 60 * 10,
            },
        },
        cache: {
            bucket: "atm-atomist-sdm-goal-cache-production",
            enabled: true,
            path: "atomist-sdm-cache",
            store: new CompressingGoalCache(new GoogleCloudStorageGoalCacheArchiveStore()),
        },
    },
};
