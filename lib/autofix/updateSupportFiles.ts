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
    EditMode,
    editModes,
    logger,
    Project,
} from "@atomist/automation-client";
import {
    AutofixRegistration,
    CodeTransformRegistration,
    ToDefaultBranch,
} from "@atomist/sdm";
import { BuildAwareMarker } from "@atomist/sdm-pack-build";
import * as appRoot from "app-root-path";
import * as fs from "fs-extra";
import * as path from "path";

/**
 * Update the TypeScript support files in a project.  They are not
 * added if they do not already exist.
 */
export async function updateSupportFilesInProject(p: Project): Promise<Project> {
    const communityFiles = ["tslint.json"];
    const baseDir = appRoot.path;
    await Promise.all(communityFiles.map(async src => {
        try {
            const destFile = await p.getFile(src);
            if (!destFile) {
                logger.debug(`Project ${p.name} has no ${src} to update`);
                return p;
            }
            const srcPath = path.join(baseDir, src);
            const content = await fs.readFile(srcPath, "utf8");
            await destFile.setContent(content);
        } catch (e) {
            logger.error(`Failed to update content of ${src} in ${p.name}: ${e.message}`);
        }
        return p;
    }));
    return p;
}

export const UpdateSupportFilesAutofix: AutofixRegistration = {
    name: "Update support files",
    pushTest: ToDefaultBranch,
    transform: updateSupportFilesInProject,
};

/**
 * Create pull request with auto-merge labels.
 */
class AutoMergeBranchCommit implements EditMode {

    get message(): string {
        return `Update TypeScript support files

${BuildAwareMarker}
`;
    }

    get branch(): string {
        return `atomist-update-support-files-${Date.now()}`;
    }

    get autoMerge(): { mode: editModes.AutoMergeMode, method: editModes.AutoMergeMethod } {
        return {
            mode: editModes.AutoMergeMode.SuccessfulCheck,
            method: editModes.AutoMergeMethod.Rebase,
        };
    }
}

export const UpdateSupportFilesTransform: CodeTransformRegistration = {
    name: "UpdateSupportFilesAndFix",
    description: "Update the TypeScript support files",
    intent: "update support files",
    transform: updateSupportFilesInProject,
    transformPresentation: ci => {
        return new AutoMergeBranchCommit();
    },
};
