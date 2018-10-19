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
    Configuration,
    safeExec,
} from "@atomist/automation-client";
// import { configureEventLog } from "@atomist/automation-client-ext-eventlog";
import { configureLogzio } from "@atomist/automation-client-ext-logzio";
import { configureRaven } from "@atomist/automation-client-ext-raven";
import {
    ConfigureOptions,
    configureSdm,
    isGitHubAction,
} from "@atomist/sdm-core";
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
    postProcessors: [
        configureLogzio,
        configureRaven,
        // configureEventLog(),
        configureSdm(machine, machineOptions),
        // TODO move into sdm-local
        async config => {
            if (isGitHubAction()) {
                await safeExec("git", ["config", "--global", "user.email", "\"bot@atomist.com\""]);
                await safeExec("git", ["config", "--global", "user.name", "\"Atomist Bot\""]);
            }
            return config;
        },
        // TODO CD remove
        async config => {
            setTimeout(() => {
                process.exit(1);
            }, 1000 * 60 * 10);
            return config;
        },
    ],
    sdm: {
        npm: {
            publish: {
                tag: {
                    defaultBranch: true,
                },
            },
        },
        k8: {
            environment: "test",
        },
        cache: {
            enabled: true,
            path: "/opt/data",
        },
    },
};
