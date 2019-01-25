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
    GitCommandGitProject,
    GitHubRepoRef,
    ProjectOperationCredentials,
    Secrets,
    SlackFileMessage,
    Success,
} from "@atomist/automation-client";
import {
    CommandHandlerRegistration,
    DeclarationType,
} from "@atomist/sdm";
import { readChangelog } from "@atomist/sdm-pack-changelog/lib/changelog/changelog";
import * as _ from "lodash";

const ChangelogRepos = [{
    repo: "sdm",
    owner: "atomist",
}, {
    repo: "sdm-core",
    owner: "atomist",
}, {
    repo: "automation-client",
    owner: "atomist",
}, {
    repo: "sdm-local",
    owner: "atomist",
}, {
    repo: "cli",
    owner: "atomist",
},
];

export const GenerateChangelog: CommandHandlerRegistration<{ token: string }> = {
    name: "generate-changelog",
    intent: "release changelog",
    description: "Generate a changelog across automation-client, sdm, sdm-core, sdm-local and cli projects",
    parameters: { token: { declarationType: DeclarationType.Secret, uri: Secrets.userToken("repo") } },
    listener: async ci => {
        // "added" | "changed" | "deprecated" | "removed" | "fixed" | "security";
        const changelog = {
            added: [],
            changed: [],
            deprecated: [],
            removed: [],
            fixed: [],
            security: [],
        };
        const versions = [];

        for (const repo of ChangelogRepos) {
            const rcl = await getChangelog(repo.repo, repo.owner, { token: ci.parameters.token });
            const entries = rcl.versions[1].parsed;
            // tslint:disable-next-line:max-line-length
            versions.push(`-   [\`@${repo.owner}/${repo.repo}@${rcl.versions[1].version}\`](https://npmjs.com/package/@${repo.owner}/${repo.repo}) - [Source Code](https://github.com/${repo.owner}/${repo.repo}), [API Docs](https://${repo.owner}.github.io/${repo.repo}/), [OSS Licenses](https://github.com/${repo.owner}/${repo.repo}/blob/master/legal/THIRD_PARTY.md)`);
            _.forEach(entries, (v, k) => {
                if (k !== "_") {
                    changelog[_.lowerFirst(k)].push(...v.map(e => `${e} \`@${repo.owner}/${repo.repo}@${rcl.versions[1].version}\``));
                }
            });
        }

        const content = [];
        content.push(`## Changelog

Here is the combined changelog for the following released projects:

${versions.join("\n")}

The format is based on [Keep a Changelog](http://keepachangelog.com/) and the projects adhere to [Semantic Versioning](http://semver.org/).
`);

        _.forEach(changelog, (v, k) => {
            if (v && v.length > 0) {
                content.push(`### ${_.upperFirst(k)}

${v.join("\n")}
`);
            }
        });

        const msg: SlackFileMessage = {
            fileName: "changelog.md",
            fileType: "markdown",
            content: content.join("\n"),
            title: "Combined Changelog",
        };
        await ci.context.messageClient.respond(msg);

        return Success;
    },
};

async function getChangelog(repo: string, owner: string, creds: ProjectOperationCredentials): Promise<any> {
    const id = GitHubRepoRef.from({ owner, repo, branch: "master" });
    const gp = await GitCommandGitProject.cloned(creds, id);
    return readChangelog(gp);
}
