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
    GitProject,
    Parameter,
    Parameters,
} from "@atomist/automation-client";
import {
    CodeTransform,
    CodeTransformRegistration,
    LoggingProgressLog,
    spawnAndLog,
} from "@atomist/sdm";

@Parameters()
export class UpdatePackageVersionParameters {

    @Parameter({
        displayName: "Desired NPM version",
        description: "The desired NPM version to update to",
        pattern: /^.+$/,
        required: true,
    })
    public version: string;
}

export const UpdatePackageVersionTransform: CodeTransform<UpdatePackageVersionParameters> =
    async (p, ctx, params) => {
        const log = new LoggingProgressLog("npm version");
        await spawnAndLog(
            log,
            "npm",
            ["version", "--no-git-tag-version", params.version],
            {
                cwd: (p as GitProject).baseDir,
                logCommand: false,
            });

        return p;
    };

export const UpdatePackageVersion: CodeTransformRegistration<UpdatePackageVersionParameters> = {
    transform: UpdatePackageVersionTransform,
    paramsMaker: UpdatePackageVersionParameters,
    name: "UpdatePackageVersion",
    description: `Update NPM Package version`,
    intent: ["update package version"],
    transformPresentation: ci => {
        return new MasterCommit(ci.parameters);
    },
};

class MasterCommit implements EditMode {

    constructor(private readonly params: UpdatePackageVersionParameters) {
    }

    get message(): string {
        return `Update NPM package version to ${this.params ? this.params.version : ""}`;
    }

    get branch(): string {
        return "master";
    }
}
