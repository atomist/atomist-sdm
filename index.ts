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

const log = require('why-is-node-running')
import { Configuration } from "@atomist/automation-client";
import { configureDashboardNotifications } from "@atomist/automation-client-ext-dashboard";
import { configureLogzio } from "@atomist/automation-client-ext-logzio";
import { configureRaven } from "@atomist/automation-client-ext-raven";
import {
    ConfigureOptions,
    configureSdm,
} from "@atomist/sdm-core";
import * as cluster from "cluster";
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
        configureDashboardNotifications,
        configureSdm(machine, machineOptions),
        async cfg => {

            if (cluster.isWorker &&
                !!process.env.ATOMIST_GOAL_UNIQUE_NAME
                && process.env.ATOMIST_GOAL_UNIQUE_NAME.includes("autofix")) {
                setInterval(function () {
                    log() // logs out active handles that are keeping node running
                }, 500).unref()
            }

            return cfg;
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
