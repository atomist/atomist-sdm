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
    EventHandlerRegistration,
    ProjectLoader,
} from "@atomist/sdm";
import {
    GitHubRepoRef,
    GraphQL,
    OnEvent,
    Parameters,
    Secret,
    Secrets,
    Success,
} from "@atomist/sdm/lib/client";
import {
    deleteBranchTag,
    NpmOptions,
} from "@atomist/sdm/lib/pack/node";

import { OnDeletedBranch } from "../typings/types";

@Parameters()
export class TokenParameters {

    @Secret(Secrets.OrgToken)
    public readonly token: string;
}

function deleteDistTagOnBranchDeletionHandle(
    projectLoader: ProjectLoader,
    options: NpmOptions): OnEvent<OnDeletedBranch.Subscription, TokenParameters> {

    return async (e, context, params) => {

        const repo = e.data.DeletedBranch[0].repo;
        const branch = e.data.DeletedBranch[0].name;
        const id = GitHubRepoRef.from({ owner: repo.owner, repo: repo.name, branch: repo.defaultBranch });

        return projectLoader.doWithProject(
            { credentials: { token: params.token }, context, readOnly: true, id },
            async p => {
                await deleteBranchTag(branch, p, options);
                return Success;
            });
    };
}

export function deleteDistTagOnBranchDeletion(
    projectLoader: ProjectLoader,
    options: NpmOptions,
): EventHandlerRegistration<OnDeletedBranch.Subscription, TokenParameters> {

    return {
        name: "DeleteDistTagOnBranchDeletion",
        description: "Delete a NPM dist-tag when a branch gets deleted",
        tags: ["branch", "npm", "dist-tag"],
        paramsMaker: TokenParameters,
        listener: deleteDistTagOnBranchDeletionHandle(projectLoader, options),
        subscription: GraphQL.subscription("onDeletedBranch"),
    };
}
