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
    EditMode,
    Parameter,
    Parameters,
    projectUtils,
} from "@atomist/automation-client";
import {
    CodeTransform,
    CodeTransformRegistration,
    formatDate,
} from "@atomist/sdm";

export const AutoMergeCheckSuccessLabel = "auto-merge:on-check-success";
export const AutoMergeCheckSuccessTag = `[${AutoMergeCheckSuccessLabel}]`;

@Parameters()
export class RewriteImportsTransformParameters {

    @Parameter({
        displayName: "Module to update imports for",
        description: "The NPM module we want imports to be rewritten to come from index. Can be a comma seperated list of module names.",
        pattern: /^.+$/,
        required: false,
    })
    public module: string = "@atomist/automation-client,@atomist/sdm,@atomist/sdm-core";

    public commitMessage: string;

}

export const RewriteImportsTransform: CodeTransform<RewriteImportsTransformParameters> =
    async (p, ctx, params) => {
        const modules = params.module;

        for (const module of modules.split(",")) {
            const regexp = new RegExp(`import\\s*?{([\\sa-zA-Z,-]*?)}\\s*from\\s*"${module.replace("/", "\/")}(?:\/.*"|");`, "gi");
            const allFiles = await projectUtils.toPromise(p.streamFiles("**/*.ts"));

            for (const f of allFiles) {
                regexp.lastIndex = 0;
                let file = f.getContentSync();
                let match;
                const files = [];
                const remove = [];
                // tslint:disable-next-line:no-conditional-assignment
                while (match = regexp.exec(file)) {
                    files.push(...match[1].split(",").map(i => i.trim()));
                    remove.push(match[0]);
                }

                if (remove.length > 0) {
                    if (files.length > 1) {
                        file = file.replace(remove[0], `import {\n    ${files.filter(fi => fi.length > 0)
                            .sort((f1, f2) => f1.localeCompare(f2)).join(",\n    ")},\n} from "${module}";`);
                    } else {
                        file = file.replace(remove[0], `import { ${files[0]} } from "${module}";`);
                    }
                    remove.slice(1).forEach(r => file = file.replace(`${r}\n`, ""));
                }
                f.setContentSync(file);
            }
        }

        return p;
    };

export const RewriteImports: CodeTransformRegistration<RewriteImportsTransformParameters> = {
    transform: RewriteImportsTransform,
    paramsMaker: RewriteImportsTransformParameters,
    name: "RewriteImports",
    description: `Rewrite imports to come from index`,
    intent: ["rewrite imports"],
    transformPresentation: ci => {
        return new BranchCommit(ci.parameters);
    },
};

class BranchCommit implements EditMode {

    constructor(private readonly params: RewriteImportsTransformParameters) {
    }

    get message(): string {
        return this.params.commitMessage || "Rewrite imports";
    }

    get branch(): string {
        return `rewrite-imports-${formatDate()}`;
    }
}
