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
    allSatisfied,
    hasFileContaining,
    PushTest,
} from "@atomist/sdm";
import { IsTypeScript } from "@atomist/sdm-core";
import { CodeTransformAutofixRegistration } from "@atomist/sdm/api/registration/AutofixRegistration";
import {
    AddHeaderParameters,
    addHeaderProjectEditor,
} from "./addHeader";

export const LicenseFilename = "LICENSE";
export const AddAtomistTypeScriptHeader: CodeTransformAutofixRegistration =
    addAtomistHeader("TypeScript header", "**/*.ts", IsTypeScript);

export function addAtomistHeader(name: string, glob: string, pushTest: PushTest): CodeTransformAutofixRegistration {
    const parameters = new AddHeaderParameters();
    parameters.glob = glob;
    // Stop it continually editing the barrel and graphql types
    parameters.excludeGlob = "src/{typings/types,index}.ts";
    return {
        name,
        pushTest: allSatisfied(pushTest, hasFileContaining(LicenseFilename, /Apache License/)),
        // Ignored any parameters passed in, which will be undefined in an autofix, and provide predefined parameters
        editor: addHeaderProjectEditor,
        parameters,
    };
}
