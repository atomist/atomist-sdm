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

import { projectUtils } from "@atomist/automation-client";
import {
    AutofixRegistration,
    hasFile,
} from "@atomist/sdm";

/**
 * Sort and format TypeScipt imports in a standard way.
 * @type {{name: string; pushTest: PredicatePushTest; transform: (p) => Promise<Project>}}
 */
export const TypeScriptImports: AutofixRegistration = {
    name: "TypeScript imports",
    pushTest: hasFile("tslint.json"),
    transform: async p => {

        const regexp = new RegExp(`import\\s*?{([\\sa-zA-Z,-]*?)}\\s*from\\s*"([@\\S]*)";`, "gi");
        const files = await projectUtils.toPromise(p.streamFiles("**/*.ts"));

        for (const f of files) {
            regexp.lastIndex = 0;
            let file = f.getContentSync();
            let match;
            // tslint:disable-next-line:no-conditional-assignment
            while (match = regexp.exec(file)) {
                const imports = match[1].split(",").map(i => i.trim());
                const module = match[2];

                if (imports.length > 1) {
                    file = file.replace(match[0], `import {\n    ${imports.filter(i => i.length > 0)
                        .sort((f1, f2) => f1.localeCompare(f2)).join(",\n    ")},\n} from "${module}";`);
                } else {
                    file = file.replace(match[0], `import { ${imports[0]} } from "${module}";`);
                }
            }

            f.setContentSync(file);
        }

        return p;
    },
};
