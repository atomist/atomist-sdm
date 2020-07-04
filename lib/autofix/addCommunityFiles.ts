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

import { Project } from "@atomist/automation-client";
import { allSatisfied, AutofixRegistration, not, ToDefaultBranch } from "@atomist/sdm";
import * as appRoot from "app-root-path";
import * as fs from "fs-extra";
import * as path from "path";
import { isNamed } from "../support/identityPushTests";

/**
 * Add/update the supporting files in a project.
 *
 * @param p Project to add files to
 * @return the project
 */
export async function addCommunityFilesToProject(p: Project): Promise<Project> {
    const communityFiles = ["CODE_OF_CONDUCT.md", "CONTRIBUTING.md", "SECURITY.md"];
    const baseDir = appRoot.path;
    return Promise.all(
        communityFiles.map(src => {
            const srcPath = path.join(baseDir, src);
            return fs.readFile(srcPath, "utf8").then(content => {
                return p.getFile(src).then(destFile => {
                    if (destFile) {
                        return destFile.setContent(content).then(() => p);
                    } else {
                        return p.addFile(src, content);
                    }
                });
            });
        }),
    ).then(() => p);
}

export const AddCommunityFiles: AutofixRegistration = {
    name: "Add community files",
    pushTest: allSatisfied(ToDefaultBranch, not(isNamed("atomist-sdm"))),
    transform: addCommunityFilesToProject,
};
