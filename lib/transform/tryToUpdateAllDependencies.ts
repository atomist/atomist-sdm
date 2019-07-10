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
    automationClientInstance,
    EditMode,
    GitProject,
    guid,
    MessageOptions,
    Parameters,
} from "@atomist/automation-client";
import {
    CodeTransform,
    CodeTransformRegistration,
    formatDate,
    spawnLog,
    StringCapturingProgressLog,
} from "@atomist/sdm";
import { BuildAwareMarker } from "@atomist/sdm-pack-build";
import {
    codeLine,
    SlackMessage,
} from "@atomist/slack-messages";

export const AutoMergeCheckSuccessLabel = "auto-merge:on-check-success";
export const AutoMergeCheckSuccessTag = `[${AutoMergeCheckSuccessLabel}]`;

@Parameters()
export class UpdateAllDependenciesParameters {

    public commitMessage: string;

}

export const UpdateAllDependenciesTransform: CodeTransform<UpdateAllDependenciesParameters> =
    async (p, ctx, params) => {
        const pjFile = await p.getFile("package.json");
        const pj = JSON.parse(await pjFile.getContent());

        const message: SlackMessage = {
            text: `Updating all NPM dependencies of ${codeLine(pj.name)}`,
            attachments: [{
                text: "",
                fallback: "Versions",
            }],
        };
        const opts: MessageOptions = {
            id: guid(),
        };

        const sendMessage = async (msg?: string) => {
            if (msg) {
                message.attachments[0].text = `${message.attachments[0].text}${msg}`;
                message.attachments[0].footer =
                    `${automationClientInstance().configuration.name}:${automationClientInstance().configuration.version}`;
            }
            await ctx.context.messageClient.respond(message, opts);
        };

        await sendMessage();

        let result = await spawnLog(
            "ncu",
            ["-u"], {
                cwd: (p as GitProject).baseDir,
                env: {
                    ...process.env,
                    NODE_ENV: "development",
                },
                log: new StringCapturingProgressLog(),
            });

        if (result.code !== 0) {
            return {
                edited: false,
                target: p,
                success: false,
            };
        }

        if (!(await (p as GitProject).isClean())) {
            await sendMessage(`\nVersions updated. Running ${codeLine("npm install")}`);
            // NPM doesn't like to go back to older versions; hence we delete the lock file here to force the
            // dependencies in
            p.deleteFileSync("package-lock.json");
            result = await spawnLog(
                "npm",
                ["i"],
                {
                    cwd: (p as GitProject).baseDir,
                    env: {
                        ...process.env,
                        NODE_ENV: "development",
                    },
                    log: new StringCapturingProgressLog(),
                },
            );
            await sendMessage(result.code === 0 ?
                `\n:atomist_build_passed: ${codeLine("npm install")} completed successfully` :
                `\n:atomist_build_failed: ${codeLine("npm install")} failed`);
            // Exit if npm install failed
            if (result.code !== 0) {
                return {
                    edited: false,
                    target: p,
                    success: false,
                };
            }
        }

        params.commitMessage = `Update all NPM dependencies

${BuildAwareMarker} ${AutoMergeCheckSuccessTag}`;

        return p;
    };

export const TryToUpdateAllDependencies: CodeTransformRegistration<UpdateAllDependenciesParameters> = {
    transform: UpdateAllDependenciesTransform,
    paramsMaker: UpdateAllDependenciesParameters,
    name: "UpdateAllDependencies",
    description: `Update all NPM dependencies`,
    intent: ["update all dependencies"],
    transformPresentation: ci => {
        return new BranchCommit(ci.parameters);
    },
};

class BranchCommit implements EditMode {

    constructor(private readonly params: UpdateAllDependenciesParameters) {
    }

    get message(): string {
        return this.params.commitMessage || "Update all NPM dependencies";
    }

    get branch(): string {
        return `atomist-update-${formatDate()}`;
    }
}
