/*
 * Copyright © 2020 Atomist, Inc.
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
	execPromise,
	ExecuteGoal,
	GoalInvocation,
	LogSuppressor,
	ProgressLog,
	PushListenerInvocation,
	pushTest,
	PushTest,
	SoftwareDeliveryMachine,
} from "@atomist/sdm";
import {
	GitCommandGitProject,
	GitHubRepoRef,
	GitProject,
	HttpClientOptions,
	HttpMethod,
	HttpResponse,
	isTokenCredentials,
	logger,
	ProjectFile,
	projectUtils,
	RemoteRepoRef,
} from "@atomist/sdm/lib/client";
import { IsNode } from "@atomist/sdm/lib/pack/node";
import * as crypto from "crypto";
import * as fs from "fs-extra";
import * as path from "path";
import { releaseHomebrew } from "./goals";
import { downloadNpmPackage } from "./nodeSupport";
import { releaseOrPreRelease, rwlcVersion } from "./release";

const homebrewFormulaGlob = ".atomist/homebrew/*.rb";

export const HasHomebrewFormula: PushTest = pushTest(
	"Has Homebrew formula template",
	async (pi: PushListenerInvocation) =>
		projectUtils.fileExists(pi.project, homebrewFormulaGlob, () => true),
);

export function addHomebrewSupport(
	sdm: SoftwareDeliveryMachine,
): SoftwareDeliveryMachine {
	releaseHomebrew.with({
		name: "homebrew-release",
		pushTest: allSatisfied(IsNode, HasHomebrewFormula),
		logInterpreter: LogSuppressor,
		goalExecutor: executeReleaseHomebrew(),
	});
	return sdm;
}

/**
 * Create the Homebrew formula and commit it to the tap.
 */
export function executeReleaseHomebrew(): ExecuteGoal {
	return async (gi: GoalInvocation) => {
		const { configuration, credentials, id, context } = gi;
		return configuration.sdm.projectLoader.doWithProject(
			{ credentials, id, context, readOnly: true },
			async (project: GitProject) => {
				const log = gi.progressLog;
				try {
					const version = await rwlcVersion(gi);
					const versionRelease = releaseOrPreRelease(version, gi);
					const pkgInfo = await downloadNpmPackage(
						project,
						gi,
						versionRelease,
					);
					log.write(
						`Creating Homebrew formula for ${project.name} version ${versionRelease}`,
					);
					const pkgSha = await fileSha256(pkgInfo.path);
					log.write(
						`Calculated SHA256 for ${path.basename(
							pkgInfo.path,
						)}: ${pkgSha}`,
					);
					try {
						await execPromise("rm", [
							"-rf",
							path.dirname(pkgInfo.path),
						]);
					} catch (e) {
						const errMsg = `Failed to remove downloaded NPM package: ${e.message}`;
						logger.warn(errMsg);
						log.write(`${errMsg}\n${e.stdout}\n${e.stderr}`);
					}
					const formulae: Record<string, string> = {};
					await projectUtils.doWithFiles(
						project,
						homebrewFormulaGlob,
						async (f: ProjectFile) => {
							log.write(`Creating Homebrew formula ${f.name}`);
							const content = await f.getContent();
							formulae[f.name] = content
								.replace(/%URL%/g, pkgInfo.url)
								.replace(/%VERSION%/g, versionRelease)
								.replace(/%SHA256%/g, pkgSha);
						},
					);
					if (Object.keys(formulae).length < 1) {
						log.write(`No formulae updated`);
						return {
							code: 0,
							message: "Found no formula to update",
						};
					}
					const formulaeRepo: RemoteRepoRef = GitHubRepoRef.from({
						owner: id.owner,
						repo: "homebrew-core",
					});
					log.write(
						`Cloning ${formulaeRepo.owner}/${formulaeRepo.repo}`,
					);
					const formulaeProject = await GitCommandGitProject.cloned(
						credentials,
						formulaeRepo,
						{
							depth: 1000,
						},
					);
					const execOpts = { cwd: formulaeProject.baseDir };
					const logOutput = await execPromise(
						"git",
						["log", "-1", "--format=%at"],
						execOpts,
					);
					const sinceTimestamp =
						Number.parseInt(logOutput.stdout.trim(), 10) - 120;
					const brewSlug = "Homebrew/homebrew-core";
					const brewRemote = "brew";
					const brewRemoteUrl = `https://github.com/${brewSlug}.git`;
					const brewBranch = "brew-master";
					log.write(`Adding Homebrew remote`);
					await execPromise(
						"git",
						["remote", "add", brewRemote, brewRemoteUrl],
						execOpts,
					);
					log.write(`Fetching Homebrew remote master`);
					await execPromise(
						"git",
						[
							"fetch",
							"--no-tags",
							`--shallow-since=${sinceTimestamp}`,
							brewRemote,
							`+master:${brewBranch}`,
						],
						execOpts,
					);
					log.write(`Rebasing onto Homebrew remote master`);
					await execPromise("git", ["rebase", brewBranch], execOpts);
					log.write(`Pushing changes from Homebrew remote master`);
					await formulaeProject.push();
					const firstFormulaBasename = Object.keys(
						formulae,
					)[0].replace(/\.rb$/, "");
					const prBranch = `${firstFormulaBasename}-${versionRelease}`;
					log.write(`Creating branch ${prBranch} for PR`);
					await formulaeProject.createBranch(prBranch);
					for (const [formulaName, formulaContent] of Object.entries(
						formulae,
					)) {
						const formulaPath = `Formula/${formulaName}`;
						const formulaFile = await formulaeProject.getFile(
							formulaPath,
						);
						if (formulaFile) {
							log.write(`Updating ${formulaPath}`);
							const formulaFileContent = await formulaFile.getContent();
							const bottledContent = restoreBottles(
								formulaContent,
								formulaFileContent,
								log,
							);
							await formulaFile.setContent(bottledContent);
						} else {
							log.write(`Adding ${formulaPath}`);
							const debottled = restoreBottles(
								formulaContent,
								"",
								log,
							);
							await formulaeProject.addFile(
								formulaPath,
								debottled,
							);
						}
					}
					log.write(
						`Committing Homebrew formula changes: ${Object.keys(
							formulae,
						).join(" ")}`,
					);
					const title = `${firstFormulaBasename} ${versionRelease}`;
					await formulaeProject.commit(title);
					log.write(`Pushing Homebrew formula changes`);
					await formulaeProject.push();
					const httpClient = configuration.http.client.factory.create();
					if (!isTokenCredentials(credentials)) {
						log.write(
							"Provided credentials do not contain GitHub.com token",
						);
						return {
							code: 1,
							message:
								"Unable to create PR because credentials did not contain token",
						};
					}
					const brewPrUrl = `https://api.github.com/repos/${brewSlug}/pulls`;
					const brewPrOptions: HttpClientOptions = {
						body: {
							base: "master",
							body: "Created by @atomist-bot.",
							head: `${formulaeRepo.owner}:${prBranch}`,
							title,
						},
						headers: {
							Accept: "application/vnd.github.v3+json",
							Authorization: `token ${credentials.token}`,
						},
						method: HttpMethod.Post,
					};
					log.write(`Creating PR in ${brewSlug}`);
					const prResp: HttpResponse<{
						html_url: string;
						number: number;
					}> = await httpClient.exchange(brewPrUrl, brewPrOptions);
					const prNumber = prResp.body.number;
					const prUrl = prResp.body.html_url;
					log.write(`Created PR ${brewSlug}#${prNumber} ${prUrl}`);
					return {
						code: 0,
						message: `Successfully created PR against ${brewSlug}`,
						externalUrls: [
							{ label: `${brewSlug}#${prNumber}`, url: prUrl },
						],
					};
				} catch (e) {
					const msg = `Failed to update Homebrew formulae: ${e.message}`;
					logger.error(msg);
					log.write(msg);
					throw e;
				}
			},
		);
	};
}

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
 * Extract the bottle section from `bottled` and insert it into
 * `updated` between the `bottle do` and `end` lines, which should be
 * consecutive.  If the `bottled` formula does not contain a bottle
 * section, remove the empty bottle section from `updated`.  If
 * `updated` does not contain a bottle section, just return the
 * unchanged `updated` formula.
 *
 * @param updated new formula content possibly with bottle empty section
 * @param bottled old formula content possibly with bottle section
 * @return new formula with old bottle section or no bottle section
 */
export function restoreBottles(
	updated: string,
	bottled: string,
	log: ProgressLog,
): string {
	const updateLines = updated.split("\n");
	const updateStart = updateLines.findIndex(l =>
		/^\s*bottle\s+do\s*$/.test(l),
	);
	if (updateStart < 0) {
		log.write("No bottle section found in updated formula");
		return updated;
	}
	if (/^\s*bottle\s+do\s*$/m.test(bottled)) {
		log.write(
			"Found bottle section found in previous formula, adding to updated formula",
		);
		const bottleLines = bottled.split("\n");
		const bottleStart = bottleLines.findIndex(l =>
			/^\s*bottle\s+do\s*$/.test(l),
		);
		const bottleEnd = bottleLines.findIndex(
			(l, i) => i > bottleStart && /^\s*end\s*$/.test(l),
		);
		updateLines.splice(
			updateStart + 1,
			0,
			...bottleLines.slice(bottleStart + 1, bottleEnd),
		);
	} else {
		log.write(
			"No bottle section found in previous formula, removing from updated formula",
		);
		updateLines.splice(updateStart, 2);
		if (
			/^\s*$/.test(updateLines[updateStart]) &&
			/^\s*$/.test(updateLines[updateStart - 1])
		) {
			updateLines.splice(updateStart, 1);
		}
	}
	return updateLines.join("\n");
}
