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

import { GitProject } from "@atomist/automation-client";
import {
    formatDate,
    LogSuppressor,
    ProgressLog,
    PushTest,
    SdmGoalEvent,
    SoftwareDeliveryMachine,
} from "@atomist/sdm";
import {
    ProjectIdentifier,
    ProjectVersionerRegistration,
} from "@atomist/sdm-core";
import {
    releaseVersion,
    version,
} from "./goals";
import { executeReleaseVersion } from "./release";

/**
 * Version projects based on the value in the file `VERSION`.
 */
export async function fileVersioner(sdmGoal: SdmGoalEvent, p: GitProject, log: ProgressLog): Promise<string> {
    const baseVersion: string = (await fileProjectIdentifier(p)).version;
    log.write(`Using base version '${baseVersion}'`);
    const branch = sdmGoal.branch;
    const branchSuffix = (branch === sdmGoal.push.repo.defaultBranch) ? "" :
        "branch-" + branch.replace(/[_/]/g, "-") + ".";
    log.write(`Commit is on branch '${branch}', using '${branchSuffix}'`);
    const ts = formatDate();
    log.write(`Current timestamp is '${ts}'`);
    const prereleaseVersion = `${baseVersion}-${branchSuffix}${ts}`;
    log.write(`Calculated pre-release version '${prereleaseVersion}'`);
    return prereleaseVersion;
}

export const HasFileVersion: PushTest = {
    name: "HasFileVersion",
    mapping: inv => inv.project.hasFile("VERSION"),
};

export const FileVersionerRegistration: ProjectVersionerRegistration = {
    name: "file-versioner",
    versioner: fileVersioner,
    logInterpreter: LogSuppressor,
    pushTest: HasFileVersion,
};

/**
 * Command for incrementing the patch value in `VERSION`.
 */
export const fileReleaseVersionCommand = {
    command: "bash",
    // tslint:disable-next-line:no-invalid-template-strings
    args: ["-c", 'if [[ -f VERSION ]];then v=$(<VERSION);p=${v##*.};echo "${v%.*}.$((++p))" >VERSION;fi'],
};

/**
 * Project identifier for projects storing the version in `VERSION`.
 */
export const fileProjectIdentifier: ProjectIdentifier = async p => {
    const versionFile = await p.getFile("VERSION");
    const versionContents = (versionFile) ? await versionFile.getContent() : "0.0.0";
    const v = versionContents.trim();
    return { name: p.name, version: v };
};

export function addFileVersionerSupport(sdm: SoftwareDeliveryMachine): SoftwareDeliveryMachine {
    version.with(FileVersionerRegistration);
    releaseVersion.with({
        name: "file-release-version",
        goalExecutor: executeReleaseVersion(fileProjectIdentifier, fileReleaseVersionCommand),
        logInterpreter: LogSuppressor,
        pushTest: HasFileVersion,
    });
    return sdm;
}
