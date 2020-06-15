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

import {
    allSatisfied,
    anySatisfied,
    ExecuteGoal,
    GoalInvocation,
    LogSuppressor,
    not,
    SoftwareDeliveryMachine,
} from "@atomist/sdm";
import {
    DockerOptions,
    HasDockerfile,
} from "@atomist/sdm-pack-docker";
import { IsNode } from "@atomist/sdm-pack-node";
import { IsMaven } from "@atomist/sdm-pack-spring";
import {
    executeLoggers,
    spawnExecuteLogger,
    SpawnWatchCommand,
} from "../support/executeLogger";
import {
    isOrgNamed,
} from "../support/identityPushTests";
import {
    dockerBuild,
    releaseDocker,
} from "./goals";
import {
    ProjectRegistryInfo,
    releaseOrPreRelease,
    rwlcVersion,
} from "./release";

/**
 * Add Docker implementations of goals to SDM.
 *
 * @param sdm Software Delivery machine to modify
 * @return modified software delivery machine
 */
export function addDockerSupport(sdm: SoftwareDeliveryMachine): SoftwareDeliveryMachine {

    const simpleDockerPushTest = allSatisfied(HasDockerfile, not(IsNode), not(IsMaven), isOrgNamed("atomist"));

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
            name: "docker-release",
            goalExecutor: executeReleaseDocker(sdm.configuration.sdm.docker.hub as DockerOptions),
            pushTest: allSatisfied(anySatisfied(IsNode, IsMaven), HasDockerfile),
            logInterpreter: LogSuppressor,
        })
        .with({
            name: "simple-docker-release",
            goalExecutor: executeReleaseDocker(sdm.configuration.sdm.docker.hub as DockerOptions),
            pushTest: simpleDockerPushTest,
            logInterpreter: LogSuppressor,
        });

    return sdm;
}

function dockerImage(p: ProjectRegistryInfo): string {
    return `${p.registry}/${p.name}:${p.version}`;
}

/**
 * Pull, tag, and push docker image.
 */
function executeReleaseDocker(options?: DockerOptions): ExecuteGoal {
    return async (gi: GoalInvocation) => {
        if (!options.registry) {
            throw new Error(`No registry defined in Docker options`);
        }
        const version = await rwlcVersion(gi);
        const image = dockerImage({
            registry: options.registry,
            name: gi.goalEvent.repo.name,
            version,
        });

        const loginArgs = [];
        if (/[^A-Za-z0-9]/.test(options.registry)) {
            loginArgs.push(options.registry);
        }

        const loginCmds: SpawnWatchCommand[] = [
            {
                cmd: {
                    command: "docker",
                    args: ["login", "--username", options.user, "--password", options.password, ...loginArgs],
                },
            },
            {
                cmd: { command: "docker", args: ["pull", image] },
            },
        ];
        let els = loginCmds.map(spawnExecuteLogger);
        const result = await executeLoggers(els, gi.progressLog);
        if (result.code !== 0) {
            return result;
        }

        const versionRelease = releaseOrPreRelease(version, gi);
        const tag = dockerImage({
            registry: options.registry,
            name: gi.goalEvent.repo.name,
            version: versionRelease,
        });

        const cmds: SpawnWatchCommand[] = [
            { cmd: { command: "docker", args: ["tag", image, tag] } },
            { cmd: { command: "docker", args: ["push", tag] } },
            { cmd: { command: "docker", args: ["rmi", tag] } },
        ];
        els = cmds.map(spawnExecuteLogger);
        return executeLoggers(els, gi.progressLog);
    };
}
