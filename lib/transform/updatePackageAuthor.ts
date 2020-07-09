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

import { CodeTransform, CodeTransformRegistration } from "@atomist/sdm";
import { editModes, logger } from "@atomist/sdm/lib/client";

const UpdatePackageAuthorTransform: CodeTransform = async (p, ctx, params) => {
    try {
        const packageJsonFile = await p.getFile("package.json");
        const packageJson = JSON.parse(await packageJsonFile.getContent());
        const author = {
            name: "Atomist",
            email: "support@atomist.com",
            url: "https://atomist.com/",
        };
        packageJson.author = author;
        await packageJsonFile.setContent(`${JSON.stringify(packageJson, undefined, 2)}\n`);
        return p;
    } catch (e) {
        await ctx.context.messageClient.respond(
            `:atomist_build_failed: Updating atomist author in package.json failed`,
        );
        logger.error(`Updating author in package.json failed: ${e.message}`);
        return p;
    }
};

export const UpdatePackageAuthor: CodeTransformRegistration = {
    transform: UpdatePackageAuthorTransform,
    name: "UpdatePackageAuthor",
    description: `Update NPM Package author`,
    intent: ["update package author"],
    transformPresentation: () => {
        return new MasterCommit();
    },
};

class MasterCommit implements editModes.EditMode {
    get message(): string {
        return `Update NPM package author to Atomist`;
    }

    get branch(): string {
        return "master";
    }
}
