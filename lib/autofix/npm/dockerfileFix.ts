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

import { logger } from "@atomist/automation-client";
import {
    allSatisfied,
    AutofixRegistration,
    hasFile,
    spawnAndLog,
    StringCapturingProgressLog,
    ToDefaultBranch,
} from "@atomist/sdm";

/**
 * Change the version of NPM that gets installed into our Docker images
 * @type {{name: string; pushTest: PredicatePushTest; transform: (p) => Promise<Project>}}
 */
export function npmDockerfileFix(...modules: string[]): AutofixRegistration {
    return {
        name: "Dockerfile NPM install",
        pushTest: allSatisfied(hasFile("Dockerfile"), ToDefaultBranch),
        transform: async p => {
            const df = await p.getFile("Dockerfile");

            let dfc = await df.getContent();
            for (const m of modules) {
                dfc = await updateToLatestVersion(m, dfc);
            }

            await df.setContent(dfc);

            return p;
        },
    };
}

export async function updateToLatestVersion(module: string, content: string): Promise<string> {
    const log = new StringCapturingProgressLog();
    const result = await spawnAndLog(
        log,
        "npm",
        ["show", module, "version"],
        {
            logCommand: false,
        });

    if (result.code !== 0) {
        return content;
    }

    logger.info(`Updating ${module} install to version '${log.log.trim()}'`);

    return updateNpmInstall(content, module, log.log.trim());
}

/**
 * Replace the version in an NPM install command.
 *
 * @param module module being installed
 * @param version desired version
 * @return content with installation of new version
 */
export function updateNpmInstall(content: string, module: string, version: string): string {
    return content.replace(new RegExp(`npm(\\s+(?:.*\\s+)?)(?:i|install|add)(\\s+(?:.*\\s+)?)${module}(?:@\\S+)?(.*)`),
        `npm\$1install\$2${module}@${version}\$3`);
}
