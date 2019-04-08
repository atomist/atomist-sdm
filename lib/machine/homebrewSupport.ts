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
    GitCommandGitProject,
    GitHubRepoRef,
    GitProject,
    logger,
    ProjectFile,
    projectUtils,
    RemoteRepoRef,
} from "@atomist/automation-client";
import {
    allSatisfied,
    DelimitedWriteProgressLogDecorator,
    execPromise,
    ExecuteGoal,
    GoalInvocation,
    LogSuppressor,
    PushListenerInvocation,
    pushTest,
    PushTest,
    SoftwareDeliveryMachine,
} from "@atomist/sdm";
import {
    ProjectIdentifier,
} from "@atomist/sdm-core";
import {
    IsNode,
    NodeProjectIdentifier,
} from "@atomist/sdm-pack-node";
import * as crypto from "crypto";
import * as fs from "fs-extra";
import * as path from "path";
import { releaseHomebrew } from "./goals";
import { downloadNpmPackage } from "./nodeSupport";
import {
    releaseOrPreRelease,
    rwlcVersion,
} from "./release";

const homebrewFormulaGlob = ".atomist/homebrew/*.rb";

export const HasHomebrewFormula: PushTest = pushTest(
    "Has Homebrew formula template",
    async (pi: PushListenerInvocation) => projectUtils.fileExists(pi.project, homebrewFormulaGlob, () => true),
);

/**
 * Compute SHA256 hash of file contents.
 *
 * @param file path to file
 * @return hex SHA256 of file contents
 */
export async function fileSha256(file: string): Promise<string> {
    const hash = crypto.createHash("sha256");
    const fileBuffer = await fs.readFile(file);
    return hash.update(fileBuffer).digest("hex");
}

/**
 * Create the Homebrew formula and commit it to the tap.
 */
export function executeReleaseHomebrew(projectIdentifier: ProjectIdentifier): ExecuteGoal {
    return async (gi: GoalInvocation) => {
        const { configuration, credentials, id, context } = gi;
        return configuration.sdm.projectLoader.doWithProject({ credentials, id, context, readOnly: true }, async (project: GitProject) => {
            const log = new DelimitedWriteProgressLogDecorator(gi.progressLog, "\n");
            try {
                const version = await rwlcVersion(gi);
                const versionRelease = releaseOrPreRelease(version, gi);
                const pkgInfo = await downloadNpmPackage(project, gi, versionRelease);
                log.write(`Creating Homebrew formula for ${project.name} version ${versionRelease}\n`);
                const pkgSha = await fileSha256(pkgInfo.path);
                log.write(`Calculated SHA256 for ${path.basename(pkgInfo.path)}: ${pkgSha}\n`);
                try {
                    await execPromise("rm", ["-rf", path.dirname(pkgInfo.path)]);
                } catch (e) {
                    const errMsg = `Failed to remove downloaded NPM package: ${e.message}`;
                    logger.warn(errMsg);
                    log.write(`${errMsg}\n${e.stdout}\n${e.stderr}\n`);
                }
                const formulae: { [key: string]: string } = {};
                await projectUtils.doWithFiles(project, homebrewFormulaGlob, async (f: ProjectFile) => {
                    log.write(`Creating Homebrew formula ${f.name}\n`);
                    const content = await f.getContent();
                    formulae[f.name] = content.replace(/%URL%/g, pkgInfo.url)
                        .replace(/%VERSION%/g, versionRelease)
                        .replace(/%SHA256%/g, pkgSha);
                });
                // is there a generic way to do this?
                const tapRepo: RemoteRepoRef = GitHubRepoRef.from({
                    owner: id.owner,
                    repo: "homebrew-tap",
                });
                log.write(`Cloning ${tapRepo.owner}/${tapRepo.repo}\n`);
                const tapProject = await GitCommandGitProject.cloned(credentials, tapRepo);
                for (const [formulaName, formulaContent] of Object.entries(formulae)) {
                    const formulaPath = `Formula/${formulaName}`;
                    log.write(`Updating ${formulaPath}\n`);
                    const formulaFile = await tapProject.getFile(formulaPath);
                    if (formulaFile) {
                        await formulaFile.setContent(formulaContent);
                    } else {
                        await tapProject.addFile(formulaPath, formulaContent);
                    }
                }
                log.write(`Committing Homebrew formula changes...`);
                const commitMsg = `Update formula from ${project.name}\n\n` +
                    `Formula updated: ${Object.keys(formulae).join(" ")}\n`;
                await tapProject.commit(commitMsg);
                log.write(` done.\nPushing Homebrew formula changes...`);
                await tapProject.push();
                log.write(` done.\n`);
                await log.flush();
            } catch (e) {
                const msg = `Failed to update Homebrew formulae: ${e.message}`;
                logger.error(msg);
                log.write(msg);
                await log.flush();
                throw e;
            }
        });
    };
}

export function addHomebrewSupport(sdm: SoftwareDeliveryMachine): SoftwareDeliveryMachine {
    releaseHomebrew.with({
        name: "homebrew-release",
        pushTest: allSatisfied(IsNode, HasHomebrewFormula),
        logInterpreter: LogSuppressor,
        goalExecutor: executeReleaseHomebrew(NodeProjectIdentifier),
    });
    return sdm;
}
