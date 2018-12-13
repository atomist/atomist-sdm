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
    MessageOptions,
    Parameter,
    Parameters,
} from "@atomist/automation-client";
import {
    CodeTransform,
    CodeTransformRegistration,
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
export class UpdateAtomistDependenciesParameters {

    @Parameter({
        displayName: "Desired NPM dist tag to update to",
        description: "The desired NPM dist tag to update dependencies to",
        pattern: /^.+$/,
        required: false,
    })
    public tag: string = "latest";

    public commitMessage: string;

}

export const UpdateAtomistDependenciesTransform: CodeTransform<UpdateAtomistDependenciesParameters> =
    async (p, ctx, params) => {
        const tag = params.tag;
        const range = (tag === "latest" ? "^" : "");
        const pjFile = await p.getFile("package.json");
        const pj = JSON.parse(await pjFile.getContent());
        const versions = [];

        const message: SlackMessage = {
            text: `Updating @atomist NPM dependencies of ${codeLine(pj.name)}`,
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

        if (pj.dependencies) {
            await updateDependencies(pj.dependencies, tag, range, versions, sendMessage);
        }
        if (pj.devDependencies) {
            await updateDependencies(pj.devDependencies, tag, range, versions, sendMessage);
        }

        await pjFile.setContent(`${JSON.stringify(pj, undefined, 2)}\n`);

        if (!(await (p as GitProject).isClean())) {
            await sendMessage(`\nVersions updated. Running ${codeLine("npm install")}`);
            // NPM doesn't like to go back to older versions; hence we delete the lock file here to force the
            // dependencies in
            p.deleteFileSync("package-lock.json");
            const result = await spawnLog(
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

        params.commitMessage = `Update @atomist NPM dependencies to tag ${params.tag}

${versions.join("\n")}

${BuildAwareMarker} ${AutoMergeCheckSuccessTag}`;

        return p;
    };

async function updateDependencies(deps: any,
                                  tag: string,
                                  range: string,
                                  versions: string[],
                                  sendMessage: (msg?: string) => Promise<void>): Promise<void> {
    for (const k in deps) {
        if (deps.hasOwnProperty(k)) {
            if (k.startsWith("@atomist/")) {
                const oldVersion = deps[k];
                const version = `${range}${await latestVersion(`${k}@${tag}`)}`;
                if (version && oldVersion !== version) {
                    deps[k] = version;
                    versions.push(`${k} ${oldVersion} > ${version}`);
                    await sendMessage(
                        `:atomist_build_passed: Updated ${codeLine(k)} from ${codeLine(oldVersion)} to ${codeLine(version)}\n`);
                }
            }
        }
    }
}

async function latestVersion(module: string): Promise<string | undefined> {
    const log = new StringCapturingProgressLog();
    const result = await spawnLog(
        "npm",
        ["show", module, "version"],
        {
            logCommand: false,
            log,
        });

    if (result.code === 0) {
        return log.log.trim();
    }

    return undefined;
}

export const TryToUpdateAtomistDependencies: CodeTransformRegistration<UpdateAtomistDependenciesParameters> = {
    transform: UpdateAtomistDependenciesTransform,
    paramsMaker: UpdateAtomistDependenciesParameters,
    name: "UpdateAtomistDependencies",
    description: `Update @atomist NPM dependencies`,
    intent: ["update atomist dependencies", "update deps", "update dependencies"],
    transformPresentation: ci => {
        return new BranchCommit(ci.parameters);
    },
};

class BranchCommit implements EditMode {

    constructor(private readonly params: UpdateAtomistDependenciesParameters) {
    }

    get message(): string {
        return this.params.commitMessage || "Update @atomist NPM dependencies";
    }

    get branch(): string {
        return `atomist-update-${this.params.tag}-${Date.now()}`;
    }
}
