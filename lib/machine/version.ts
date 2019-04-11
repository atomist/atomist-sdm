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
import {
    ExecuteGoalResult,
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
import * as semver from "semver";
import {
    releaseVersion,
    version,
} from "./goals";
import {
    addBranchPreRelease,
    executeReleaseVersion,
} from "./release";

/**
 * Version projects based on the value in the file `VERSION`.
 */
export async function fileVersioner(sdmGoal: SdmGoalEvent, p: Project, log: ProgressLog): Promise<string> {
    const baseVersion: string = (await fileProjectIdentifier(p)).version;
    log.write(`Using base version '${baseVersion}'`);
    const prereleaseVersion = addBranchPreRelease(baseVersion, sdmGoal);
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
export async function fileIncrementPatch(p: Project, log: ProgressLog): Promise<ExecuteGoalResult> {
    const vPath = "VERSION";
    const vFile = await p.getFile(vPath);
    if (!vFile) {
        const msg = `Project does not have '${vPath}' file`;
        log.write(msg);
        return { code: 1, message: msg };
    }
    const currentVersion = (await vFile.getContent()).trim();
    if (!currentVersion) {
        const msg = `Failed to extract version from '${vPath}' file`;
        log.write(msg);
        return { code: 1, message: msg };
    }
    const newVersion = semver.inc(currentVersion, "patch");
    if (!newVersion || newVersion === currentVersion) {
        const msg = `Failed to increment patch in version '${currentVersion}' from '${vPath}' file`;
        log.write(msg);
        return { code: 1, message: msg };
    }
    await vFile.setContent(newVersion + "\n");
    const message = `Incremented patch level in '${vPath}' file: ${currentVersion} => ${newVersion}`;
    log.write(message);
    return { code: 0, message };
}

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
        goalExecutor: executeReleaseVersion(fileProjectIdentifier, fileIncrementPatch),
        logInterpreter: LogSuppressor,
        pushTest: HasFileVersion,
    });
    return sdm;
}
