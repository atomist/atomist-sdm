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
    GitProject,
    Project,
    RemoteRepoRef,
} from "@atomist/automation-client";
import {
    ExecuteGoalResult,
    GoalInvocation,
    LogSuppressor,
    spawnLog,
    SpawnLogCommand,
    SpawnLogOptions,
} from "@atomist/sdm";
import {
    cachePut,
    cacheRestore,
} from "@atomist/sdm-core";
import {
    Builder,
    spawnBuilder,
} from "@atomist/sdm-pack-build";
import { IsNode } from "@atomist/sdm-pack-node";

const webNpmCommands: SpawnLogCommand[] = [
    { command: "npm", args: ["ci"], options: { env: { ...process.env, NODE_ENV: "development" }, log: undefined } },
    { command: "npm", args: ["run", "compile"] },
    { command: "npm", args: ["run", "test"] },
];

function spawnCommandString(cmd: SpawnLogCommand): string {
    return cmd.command + " " + cmd.args.join(" ");
}

export async function webNpmBuild(project: GitProject, goalInvocation: GoalInvocation): Promise<ExecuteGoalResult> {
    const siteRoot = await project.getFile("public/index.html");
    if (siteRoot) {
        return { code: 0, message: `Site directory already exists in '${project.baseDir}'` };
    }
    const log = goalInvocation.progressLog;
    const opts: SpawnLogOptions = {
        cwd: project.baseDir,
        env: { ...process.env, NODE_ENV: "development" },
        log,
    };
    for (const spawnCmd of webNpmCommands) {
        const res = await spawnLog(spawnCmd.command, spawnCmd.args, opts);
        if (res.code) {
            log.write(`Command failed '${spawnCommandString(spawnCmd)}': ${res.error.message}`);
            return res;
        }
    }
    return { code: 0, message: "Site NPM build successful" };
}

const webNpmCacheClassifier = "npm-web-cache";
export const webNpmCachePut = cachePut({
    entries: [
        { classifier: webNpmCacheClassifier, pattern: { directory: "public" } },
    ],
    pushTest: IsNode,
});
export const webNpmCacheRestore = cacheRestore({
    entries: [{ classifier: webNpmCacheClassifier }],
    onCacheMiss: {
        name: "cache-miss-web-npm-build",
        listener: webNpmBuild,
    },
    pushTest: IsNode,
});

export function webBuilder(sitePath: string): Builder {
    const commands = webNpmCommands;
    return spawnBuilder({
        name: "WebBuilder",
        commands,
        logInterpreter: LogSuppressor,
        projectToAppInfo: async (p: Project) => {
            let version: string;
            const versionFile = await p.getFile("VERSION");
            if (versionFile) {
                version = (await versionFile.getContent()).trim();
            } else {
                const pkgFile = await p.getFile("package.json");
                if (pkgFile) {
                    const pkg = JSON.parse(await pkgFile.getContent());
                    version = pkg.version;
                } else {
                    version = "0.0.0";
                }
            }
            return {
                id: p.id as RemoteRepoRef,
                name: p.name,
                version,
            };
        },
    });
}
