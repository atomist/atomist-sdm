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
    automationClientInstance,
    EditMode,
    GitProject,
    guid,
    logger,
    MessageOptions,
    Parameters,
} from "@atomist/automation-client";
import {
    CodeTransform,
    CodeTransformRegistration,
    spawnAndLog,
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
class UpdateAtomistPeerDependenciesParameters {
    public commitMessage: string;

}

const UpdateAtomistPeerDependenciesStarTransform: CodeTransform<UpdateAtomistPeerDependenciesParameters> =
    async (p, ctx, params) => {
        try {
            const pjFile = await p.getFile("package.json");
            const pj = JSON.parse(await pjFile.getContent());
            let versions: string[] = [];

            const message: SlackMessage = {
                text: `Updating @atomist NPM peer dependencies of ${codeLine(pj.name)}`,
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

            if (pj.peerDependencies) {
                versions = await updatePeerDependencies(pj.peerDependencies, sendMessage);
            }

            await pjFile.setContent(`${JSON.stringify(pj, undefined, 2)}\n`);

            if (!(await (p as GitProject).isClean())) {
                await sendMessage(`\nAtomist peer dependency versions updated. Running ${codeLine("npm install")}`);
                const result = await spawnAndLog(
                    new StringCapturingProgressLog(),
                    "npm",
                    ["i"],
                    {
                        cwd: (p as GitProject).baseDir,
                        env: {
                            ...process.env,
                            NODE_ENV: "development",
                        },
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

            params.commitMessage = `Update @atomist NPM peer dependencies to *

${versions.join("\n")}

${BuildAwareMarker} ${AutoMergeCheckSuccessTag}`;

            return p;
        } catch (e) {
            await ctx.context.messageClient.respond(`\n:atomist_build_failed: Updating peer dependencies in package.json failed`);
            logger.error(`Updating peer dependencies in package.json failed: ${e.message}`);
            return p;
        }
    };

async function updatePeerDependencies(deps: any,
                                      sendMessage: (msg?: string) => Promise<void>): Promise<string[]> {
    const versions: string[] = [];
    for (const k in deps) {
        if (deps.hasOwnProperty(k)) {
            if (k.startsWith("@atomist/")) {
                const oldVersion = deps[k];
                const version = `*`;
                if (oldVersion !== version) {
                    deps[k] = version;
                    versions.push(`${k} ${oldVersion} > ${version}`);
                    await sendMessage(
                        `:atomist_build_passed: Updated ${codeLine(k)} from ${codeLine(oldVersion)} to ${codeLine(version)}\n`);
                }
            }
        }
    }
    return versions;
}

export const TryToUpdateAtomistPeerDependencies: CodeTransformRegistration<UpdateAtomistPeerDependenciesParameters> = {
    transform: UpdateAtomistPeerDependenciesStarTransform,
    paramsMaker: UpdateAtomistPeerDependenciesParameters,
    name: "UpdateAtomistPeerDependencies",
    description: `Update @atomist NPM peer dependencies`,
    intent: ["update atomist peer dependencies", "update peer deps", "update peer dependencies"],
    transformPresentation: ci => {
        return new BranchCommit(ci.parameters);
    },
};

class BranchCommit implements EditMode {

    constructor(private readonly params: UpdateAtomistPeerDependenciesParameters) {
    }

    get message(): string {
        return this.params.commitMessage || "Update @atomist NPM peer dependencies";
    }

    get branch(): string {
        return `atomist-update-peer-deps-${Date.now()}`;
    }
}
