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
    GitProject,
    isLocalProject,
    logger,
    NoParameters,
    Project,
    ProjectReview,
    RemoteRepoRef,
    ReviewComment,
    Severity,
    SourceLocation,
} from "@atomist/automation-client";
import {
    CodeInspection,
    CodeInspectionRegistration,
    execPromise,
    ExecuteGoalResult,
    GoalInvocation,
    GoalProjectListenerEvent,
    GoalProjectListenerRegistration,
    LogSuppressor,
    PushTest,
    spawnLog,
    SpawnLogCommand,
    SpawnLogOptions,
} from "@atomist/sdm";
import {
    Builder,
    spawnBuilder,
} from "@atomist/sdm-pack-build";
import * as fs from "fs-extra";
import * as path from "path";

export const IsJekyllProject: PushTest = {
    name: "IsJekyllProject",
    mapping: inv => inv.project.hasFile("_config.yml"),
};

const webNpmCommands: SpawnLogCommand[] = [
    { command: "npm", args: ["ci"], options: { env: { ...process.env, NODE_ENV: "development" }, log: undefined } },
    { command: "npm", args: ["run", "compile"] },
];

function spawnCommandString(cmd: SpawnLogCommand): string {
    return cmd.command + " " + cmd.args.join(" ");
}

export async function webNpmBuild(project: GitProject, goalInvocation: GoalInvocation): Promise<ExecuteGoalResult> {
    const siteRoot = await project.getFile("public/index.html");
    if (siteRoot) {
        return { code: 0, message: `Site directory already exists in '${project.baseDir}'` };
    }
    const log = goalInvocation.progressLog;
    const opts: SpawnLogOptions = {
        cwd: project.baseDir,
        env: { ...process.env, NODE_ENV: "development" },
        log,
    };
    for (const spawnCmd of webNpmCommands) {
        const res = await spawnLog(spawnCmd.command, spawnCmd.args, opts);
        if (res.code) {
            log.write(`Command failed '${spawnCommandString(spawnCmd)}': ${res.error.message}`);
            return res;
        }
    }
    return { code: 0, message: "Site NPM build successful" };
}

export const WebNpmBuildAfterCheckout: GoalProjectListenerRegistration = {
    name: "npm web build",
    events: [GoalProjectListenerEvent.before],
    listener: webNpmBuild,
};

const jekyllCommands: SpawnLogCommand[] = [
    { command: "bundle", args: ["install"] },
    { command: "bundle", args: ["exec", "jekyll", "build"] },
];

export async function jekyllBuild(project: GitProject, goalInvocation: GoalInvocation): Promise<ExecuteGoalResult> {
    const siteRoot = await project.getFile("_site/index.html");
    if (siteRoot) {
        return { code: 0, message: `Site directory already exists in '${project.baseDir}'` };
    }
    const log = goalInvocation.progressLog;
    const opts: SpawnLogOptions = {
        cwd: project.baseDir,
        log,
    };
    for (const spawnCmd of jekyllCommands) {
        const res = await spawnLog(spawnCmd.command, spawnCmd.args, opts);
        if (res.code) {
            log.write(`Command failed '${spawnCommandString(spawnCmd)}': ${res.error.message}`);
            return res;
        }
    }
    return { code: 0, message: "Site Jekyll build successful" };
}

export const JekyllBuildAfterCheckout: GoalProjectListenerRegistration = {
    name: "jekyll build",
    events: [GoalProjectListenerEvent.before],
    listener: jekyllBuild,
};

export function webBuilder(sitePath: string): Builder {
    const commands = (sitePath === "_site") ? jekyllCommands : webNpmCommands;
    return spawnBuilder({
        name: "WebBuilder",
        commands,
        logInterpreter: LogSuppressor,
        projectToAppInfo: async (p: Project) => {
            let version: string;
            const versionFile = await p.getFile("VERSION");
            if (versionFile) {
                version = (await versionFile.getContent()).trim();
            } else {
                const pkgFile = await p.getFile("package.json");
                if (pkgFile) {
                    const pkg = JSON.parse(await pkgFile.getContent());
                    version = pkg.version;
                } else {
                    version = "0.0.0";
                }
            }
            return {
                id: p.id as RemoteRepoRef,
                name: p.name,
                version,
            };
        },
    });
}

/**
 * Run htmltest on `sitePath` and convert results to ReviewComments.
 *
 * @param sitePath path to web site relative to root of project
 * @return function that takes a project and returns ReviewComments
 */
function runHtmltest(sitePath: string): CodeInspection<ProjectReview, NoParameters> {
    return async (p: Project) => {
        const review: ProjectReview = { repoId: p.id, comments: [] };
        if (!isLocalProject(p)) {
            logger.error(`Project ${p.name} is not a local project`);
            return review;
        }
        if (!await p.hasDirectory(sitePath)) {
            logger.error(`Project ${p.name} does not have site directory '${sitePath}'`);
            return review;
        }
        const absPath = path.join(p.baseDir, sitePath);
        logger.debug(`Running htmltest on ${absPath}`);
        try {
            const result = await execPromise("htmltest", [absPath]);
            if (result.stderr) {
                logger.debug(`htmltest standard error from ${p.name}: ${result.stderr}`);
            }
            logger.debug(`htmltest standard output from ${p.name}: ${result.stdout}`);
            const comments = await mapHtmltestResultsToReviewComments(p.baseDir);
            review.comments.push(...comments);
        } catch (e) {
            logger.error(`Failed to run htmltest: ${e.message}`);
        }
        return review;
    };
}

export function htmltestInspection(sitePath: string): CodeInspectionRegistration<ProjectReview, NoParameters> {
    return {
        name: "RunHtmltest",
        description: "Run htmltest on website",
        inspection: runHtmltest(sitePath),
        intent: "htmltest",
    };
}

/**
 * Convert the output of htmltest to proper ReviewComments.  If any
 * part of the process fails, an empty array is returned.
 *
 * @param output string output from running `htmltest` that will be parsed and converted.
 * @return htmltest errors and warnings as ReviewComments
 */
export async function mapHtmltestResultsToReviewComments(baseDir: string): Promise<ReviewComment[]> {
    const logFile = path.join(baseDir, "tmp", ".htmltest", "htmltest.log");
    const logContent = await fs.readFile(logFile, "utf8");
    return htmltestLogToReviewComments(logContent);
}

/**
 * Testable unit of mapHtmltestResultsToReviewComments.
 */
export function htmltestLogToReviewComments(logContent: string): ReviewComment[] {
    const resultRegExp = /^(.*?)\s+---\s+(.*?)\s+-->\s+(.*?)$/;
    const comments = logContent.split("\n").map(r => r.trim()).filter(r => r).map(r => {
        const matches = resultRegExp.exec(r);
        if (!matches) {
            logger.warn(`Failed to match htmltest output line '${r}': ${JSON.stringify(matches)}`);
            return undefined;
        }
        const [description, sourcePath, detail] = matches.slice(1);
        const sourceLocation: SourceLocation = {
            path: sourcePath,
            offset: 0,
        };
        const severity: Severity = (description === "target does not exist") ? "error" : "warn";
        return {
            category: "htmltest",
            detail,
            severity,
            sourceLocation,
            subcategory: description,
        };
    }).filter(r => r);
    return comments;
}
