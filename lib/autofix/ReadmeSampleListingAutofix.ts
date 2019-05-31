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

import { projectUtils } from "@atomist/automation-client";
import {
    allSatisfied,
    AutofixRegistration,
} from "@atomist/sdm";
import { codeLine } from "@atomist/slack-messages";
import {
    isNamed,
    isOrgNamed,
} from "../support/identityPushTests";

const DescriptionRegexp = new RegExp(/\* @description (.*)/, "g");
const TagsRegexp = new RegExp(/\* @tag (.*)/, "g");

/**
 * Autofix to update the sample listing in the samples repository
 */
export const ReadmeSampleListingAutofix: AutofixRegistration = {
    name: "README.md sample listing",
    pushTest: allSatisfied(isOrgNamed("atomist"), isNamed("samples")),
    transform: async p => {
        const samples = (await projectUtils.gatherFromFiles<{ name: string, description: string, tags: string[] }>(p, ["**/*.ts"], async f => {
            if (!f.path.includes("lib/")) {
                return undefined;
            }
            const content = await f.getContent();
            DescriptionRegexp.lastIndex = 0;
            TagsRegexp.lastIndex = 0;
            const descriptionMatch = DescriptionRegexp.exec(content);

            const tagsMatch = TagsRegexp.exec(content);
            const tags: string[] = [];
            if (!!tagsMatch) {
                tags.push(...tagsMatch[1].split(","));
            }

            if (!!descriptionMatch) {
                return {
                    name: f.path,
                    description: descriptionMatch[1],
                    tags: tags.sort(),
                };
            }
            return undefined;
        })).filter(s => !!s);

        const sampleTable = `<!---atomist:sample=start--->
|Name|Description|Tags|
|----|-----------|----|
${samples.map(s => `|[${codeLine(s.name)}](${s.name})|${s.description}|${s.tags.join(", ")}|`).join("\n")}
<!---atomist:sample=end--->`;

        const readme = await p.getFile("README.md");
        const readmeContent = await readme.getContent();
        const newReadmeContent = readmeContent.replace(/<!---atomist:samples=start--->[\s\S]*<!---atomist:samples=end--->/gm, sampleTable);
        await readme.setContent(newReadmeContent);

        return p;
    },
};
