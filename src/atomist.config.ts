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

import { Configuration } from "@atomist/automation-client";
// import { configureEventLog } from "@atomist/automation-client-ext-eventlog";
import { configureLogzio } from "@atomist/automation-client-ext-logzio";
import { configureRaven } from "@atomist/automation-client-ext-raven";
import { configureSdm } from "@atomist/sdm-core";
import { ConfigureOptions } from "@atomist/sdm-core/internal/machine/configureSdm";
import { machine } from "./machine/machine";

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
    postProcessors: [
        configureLogzio,
        configureRaven,
        // configureEventLog(),
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
    },
};

// test
// test
// test
// test
// test
// test
// test
