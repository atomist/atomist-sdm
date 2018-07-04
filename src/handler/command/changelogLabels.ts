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
    HandlerContext,
    MappedParameter,
    MappedParameters,
    Parameters,
    Secret,
    Secrets,
    Success,
} from "@atomist/automation-client";
import { CommandHandlerRegistration } from "@atomist/sdm";
import { bold } from "@atomist/slack-messages";
import * as github from "../../support/gitHubApi";
import { success } from "../../support/messages";

export const ChangelogLabels = [
    "added",
    "changed",
    "deprecated",
    "removed",
    "fixed",
    "security",
];

@Parameters()
export class ChangelogParameters {

    @MappedParameter(MappedParameters.GitHubOwner)
    public owner: string;

    @MappedParameter(MappedParameters.GitHubRepository)
    public repo: string;

    @MappedParameter(MappedParameters.GitHubApiUrl)
    public apiUrl: string;

    @Secret(Secrets.userToken("repo"))
    public githubToken: string;
}

/**
 * CommandHandler to add required changelog labels to a given repo.
 * @returns {HandleCommand<ChangelogParameters>}
 */
export const AddChangelogLabels: CommandHandlerRegistration<ChangelogParameters> = {
    name: "AddChangelogLabels",
    intent: "add changelog labels",
    description: "Add changelog labels to a GitHub repo",
    tags: ["github", "changelog", "label"],
    paramsMaker: ChangelogParameters,
    createCommand: () => async (ctx: HandlerContext, params: ChangelogParameters) => {
        const api = github.api(params.githubToken, params.apiUrl);

        ChangelogLabels.forEach(async l => {
            const name = `changelog:${l}`;
            try {
                await api.issues.getLabel({
                    name,
                    repo: params.repo,
                    owner: params.owner,
                });
            } catch (err) {
                await api.issues.createLabel({
                    owner: params.owner,
                    repo: params.repo,
                    name,
                    color: "C5DB71",
                });
            }
        });
        await ctx.messageClient.respond(success(
            "Changelog",
            `Successfully added changelog labels to ${bold(`${params.owner}/${params.repo}`)}`));
        return Success;
    },
};
