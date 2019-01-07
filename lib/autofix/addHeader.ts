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
    Parameter,
    Parameters,
    Project,
    projectUtils,
} from "@atomist/automation-client";
import {
    PushAwareParametersInvocation,
} from "@atomist/sdm";
import * as minimatch from "minimatch";
import { CFamilyLanguageSourceFiles } from "./GlobPatterns";
import { RequestedCommitParameters } from "./RequestedCommitParameters";

/**
 * Default glob pattern matches all C family languages
 */
@Parameters()
export class AddHeaderParameters extends RequestedCommitParameters {

    @Parameter({ required: false })
    public glob: string = CFamilyLanguageSourceFiles;

    @Parameter({ required: false })
    public excludeGlob: string;

    @Parameter({ required: false })
    public onlyChangedFiles: boolean = false;

    @Parameter({ required: false })
    public license: "apache" = "apache";

    constructor() {
        super("Add missing license headers");
    }

    get header(): string {
        switch (this.license) {
            case "apache":
                return apacheHeader();
            default:
                throw new Error(`'${this.license}' is not a supported license`);
        }
    }
}

export function apacheHeader(): string {
    const year = (new Date()).getFullYear();
    return `/*
 * Copyright © ${year} Atomist, Inc.
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
`;
}

/**
 * CodeTransform that upserts headers into files per [[AddHeaderParameters]].
 */
export async function addHeaderTransform(p: Project, ci: PushAwareParametersInvocation<AddHeaderParameters>): Promise<Project> {
    await projectUtils.doWithFiles(p, ci.parameters.glob, async f => {
        if (ci.parameters.excludeGlob && minimatch(f.path, ci.parameters.excludeGlob)) {
            return;
        }

        if (ci.parameters.onlyChangedFiles) {
            if (ci.push.filesChanged &&
                ci.push.filesChanged.length > 0) {
                if (!ci.push.filesChanged.includes(f.path)) {
                    return;
                }
            } else {
                return;
            }
        }

        const content = await f.getContent();
        const header = ci.parameters.header;
        const newContent = upsertHeader(header, content);
        if (newContent !== content) {
            await f.setContent(newContent);
        }
        return;
    });
    return p;
}

/**
 * There are some lines that really need to be at the top.
 *
 * If a file starts with '#!/executable/to/run', leave that at the
 * top.  It's invalid to put a comment before it.
 *
 * @param content to extract sh-bang line from
 * @return two-element array, the first element if the sh-bang line or
 *         an empty string if there is no sh-bang line, the second element
 *         is the rest of the content.
 */
function separatePrefixLines(content: string): [string, string] {
    if (content.startsWith("#!")) {
        const lines = content.split("\n");
        return [lines[0] + "\n", lines.slice(1).join("\n")];
    }
    return ["", content];
}

/**
 * Add or replace begining empty lines and any header comment in
 * `content` with `header`.
 *
 * @param header header that should be upserted into content
 * @param content current content to be updated
 * @return updated content that contains header
 */
export function upsertHeader(header: string, content: string): string {
    const [prefix, rest] = separatePrefixLines(content);
    const preamble = prefix + header + "\n";
    return preamble + rest.replace(/^(?:\s*\n)?(?:\/\*[\s\S]*?\*\/\s*\n)?/, "");
}
