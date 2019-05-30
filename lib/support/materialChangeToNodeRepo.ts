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

import { logger } from "@atomist/automation-client";
import {
    anyFileChangedSuchThat,
    anyFileChangedWithExtension,
    filesChangedSince,
    pushTest,
    PushTest,
} from "@atomist/sdm";
import * as _ from "lodash";

const FilesWithExtensionToWatch = ["ts", "json", "graphql"];
const FilesToWatch = [
    "Dockerfile",
    ".gitattributes",
    ".npmignore",
    ".dockerignore",
    ".gitignore",
    "CODE_OF_CONDUCT.md",
    "CONTRIBUTIONS.md" ,
    "SECURITY.md"];
const DirectoriesToWatch = [".atomist/", "legal"];

/**
 * Veto if change to deployment unit doesn't seem important enough to
 * build and deploy
 */
export const MaterialChangeToNodeRepo: PushTest = pushTest("Material change to Node repo", async pci => {
    const changedFiles = await filesChangedSince(pci.project, pci.push);
    if (!changedFiles) {
        logger.info("Cannot determine if change is material on %j: can't enumerate changed files", pci.id);
        return true;
    }
    logger.debug(`MaterialChangeToNodeRepo: Changed files are [${changedFiles.join(",")}]`);
    if (anyFileChangedWithExtension(changedFiles, FilesWithExtensionToWatch) ||
        anyFileChangedSuchThat(changedFiles, path => FilesToWatch.some(f => path === f)) ||
        anyFileChangedSuchThat(changedFiles, path => DirectoriesToWatch.some(d => path.startsWith(d)))) {
        logger.debug("Change is material on %j: changed files=[%s]", pci.id, changedFiles.join(","));
        return true;
    }
    const repoName: string = _.get(pci, "push.repo.name");
    if (repoName === "developer-tutorials") {
        return true;
    }
    logger.debug("Change is immaterial on %j: changed files=[%s]", pci.id, changedFiles.join(","));
    return false;
});
