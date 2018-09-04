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
    MappedParameter,
    MappedParameters,
    Parameter,
    Secret,
    Secrets,
    Success,
    Value,
} from "@atomist/automation-client";
import { Parameters } from "@atomist/automation-client/decorators";
import { GitHubRepoRef } from "@atomist/automation-client/operations/common/GitHubRepoRef";
import { CommandHandlerRegistration } from "@atomist/sdm";
import {
    fetchDefaultBranchTip,
    tipOfBranch,
} from "@atomist/sdm-core/handlers/events/delivery/goals/resetGoals";
import {
    createTag,
    Tag,
} from "@atomist/sdm-core/util/github/ghub";
import { success } from "@atomist/sdm/api-helper/misc/slack/messages";
import { codeLine } from "@atomist/slack-messages";

@Parameters()
export class CreateTagParameters {

    @Secret(Secrets.UserToken)
    public githubToken: string;

    @MappedParameter(MappedParameters.GitHubOwner)
    public owner: string;

    @MappedParameter(MappedParameters.GitHubRepository)
    public repo: string;

    @MappedParameter(MappedParameters.GitHubRepositoryProvider)
    public providerId: string;

    @Parameter({required: false})
    public sha: string;

    @Parameter({required: false})
    public branch: string;

    @Value("name")
    public name: string;
}

export const CreateTag: CommandHandlerRegistration<CreateTagParameters> = {
    name: "CreateTag",
    intent: "create tag",
    description: "Create tag on GitHub",
    paramsMaker: CreateTagParameters,
    listener: async ci => {

        // figure out which commit
        const repoData = await fetchDefaultBranchTip(ci.context, ci.parameters);
        const branch = ci.parameters.branch || repoData.defaultBranch;
        const sha = ci.parameters.sha || tipOfBranch(repoData, branch);
        const id = GitHubRepoRef.from({owner: ci.parameters.owner, repo: ci.parameters.repo, sha, branch});

        const tag: Tag = {
            tag: ci.parameters.name,
            message: `Created tag ${ci.parameters.name}`,
            object: sha,
            type: "commit",
            tagger: {
                name: "Atomist",
                email: "info@atomist.com",
                date: new Date().toISOString(),
            },
        };
        await createTag({ token: ci.parameters.githubToken}, id, tag);

        await ci.context.messageClient.respond(
            success(
                "Create Tag",
                `Successfully created tag ${codeLine(ci.parameters.name)} on commit ${codeLine(sha.slice(0, 7))}`));

        return Success;
    },
};
