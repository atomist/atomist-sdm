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
    Project,
    RemoteRepoRef,
} from "@atomist/automation-client";
import {
    allSatisfied,
    ExecuteGoalResult,
    GoalInvocation,
    GoalProjectListenerEvent,
    GoalProjectListenerRegistration,
    hasFile,
    LogSuppressor,
    ProgressLog,
    SoftwareDeliveryMachine,
    spawnLog,
    SpawnLogOptions,
    SpawnLogResult,
} from "@atomist/sdm";
import { ProjectVersioner } from "@atomist/sdm-core";
import { Builder } from "@atomist/sdm-pack-build";
import {
    DockerOptions,
} from "@atomist/sdm-pack-docker";
import * as fs from "fs-extra";
import * as path from "path";
import * as semver from "semver";
import {
    build,
    dockerBuild,
    noOpGoalExecutor,
    publish,
    release,
    releaseDocs,
    releaseVersion,
    version,
} from "./goals";
import {
    addBranchPreRelease,
    executeReleaseVersion,
} from "./release";

/**
 * Push test for Go projects built with make.
 */
export const IsGoMake = allSatisfied(hasFile("main.go"), hasFile("Makefile"));

/**
 * Push test for Go projects built with make with Dockerfile.
 */
export const IsGoMakeDocker = allSatisfied(IsGoMake, hasFile("docker/Dockerfile"));

/**
 * Add Go support and implementations of SDM goals.
 *
 * @param sdm Software Delivery machine to modify
 * @return modified software delivery machine
 */
export function addGoSupport(sdm: SoftwareDeliveryMachine): SoftwareDeliveryMachine {

    version.with({
        name: "go-versioner",
        logInterpreter: LogSuppressor,
        pushTest: IsGoMake,
        versioner: GoVersioner,
    });

    build.with({
        name: "go-make-build",
        builder: GoBuilder,
        pushTest: IsGoMake,
    });

    publish.with({
        name: "go-publish",
        goalExecutor: noOpGoalExecutor,
        pushTest: IsGoMake,
    });

    dockerBuild.with({
        name: "go-docker-build",
        options: {
            ...sdm.configuration.sdm.docker.hub as DockerOptions,
            push: true,
            builder: "docker",
            builderPath: "docker",
            dockerfileFinder: async () => "docker/Dockerfile",
        },
        logInterpreter: LogSuppressor,
        pushTest: IsGoMakeDocker,
    })
        .withProjectListener(GoDockerBuild);

    release.with({
        name: "go-release",
        goalExecutor: noOpGoalExecutor,
        pushTest: IsGoMake,
    });

    releaseVersion.with({
        name: "go-release-version",
        goalExecutor: executeReleaseVersion(goProjectIdentifier, goIncrementPatch),
        logInterpreter: LogSuppressor,
        pushTest: IsGoMake,
    });

    releaseDocs.with({
        name: "go-release",
        goalExecutor: noOpGoalExecutor,
        pushTest: IsGoMake,
    });

    return sdm;
}

const goExtractVersionRegExp = /^[\S\s]*\bversion\s*=\s*"(\d+\.\d+\.\d+)"[\S\s]*$/;
const goSetVersionRegExp = /^(\s*version\s*=\s*)"(\d+\.\d+\.\d+)"\s*$/m;

const GoVersioner: ProjectVersioner = async (e, p, l) => {
    const baseVersion = (await goProjectIdentifier(p)).version;
    l.write(`Using base version '${baseVersion}'`);
    const prereleaseVersion = addBranchPreRelease(baseVersion, e);
    l.write(`Calculated pre-release version '${prereleaseVersion}'`);
    return prereleaseVersion;
};

/**
 * Extract project information from Go project.
 */
export const goProjectIdentifier = async (p: Project) => {
    let v: string;
    const versionFile = await p.getFile("cmd/version.go");
    if (versionFile) {
        v = (await versionFile.getContent()).replace(goExtractVersionRegExp, "$1");
    } else {
        v = "0.0.0";
    }
    return {
        id: p.id as RemoteRepoRef,
        name: p.name,
        version: v,
    };
};

interface ProjectGoPath {
    goPath: string;
    goProjectDir: string;
}

function projectGoPath(project: GitProject): ProjectGoPath {
    const goPath = path.join(project.baseDir, ".gosdm");
    const goProjectDir = path.join(goPath, "src", "github.com", "atomist", project.name);
    return { goPath, goProjectDir };
}

/**
 * Hack a GOPATH to work with the way the SDM checks projects out.
 */
export async function goPathHack(project: GitProject, goalInvocation: GoalInvocation): Promise<ExecuteGoalResult> {
    const log = goalInvocation.progressLog;
    const pgp = projectGoPath(project);
    if (fs.existsSync(pgp.goProjectDir)) {
        const msg = `Go project directory already exists: ${pgp.goProjectDir}`;
        log.write(msg);
        return { code: 0, message: msg };
    }
    try {
        const projectCopyPath = project.baseDir + ".gosdm.tmp";
        await fs.ensureDir(projectCopyPath);
        await fs.copy(project.baseDir, projectCopyPath);
        await fs.ensureDir(pgp.goProjectDir);
        await fs.move(projectCopyPath, pgp.goProjectDir, { overwrite: true });
    } catch (e) {
        const msg = `Failed to create GOPATH directory tree for ${project.name}: ${e.message}`;
        log.write(msg);
        return { code: 1, message: msg };
    }
    const message = `Created GOPATH tree for ${project.name}: ${pgp.goProjectDir}`;
    log.write(message);
    return { code: 0, message };
}

export const GoPathHack: GoalProjectListenerRegistration = {
    name: "go path hack",
    events: [GoalProjectListenerEvent.before],
    listener: goPathHack,
    pushTest: IsGoMake,
};

/**
 * Generic make executor for Go projects.  GoPathHack should be
 * executed before this.
 */
async function goMake(p: GitProject, log: ProgressLog, args: string[] = []): Promise<SpawnLogResult> {
    const makeOptions: SpawnLogOptions = {
        cwd: p.baseDir,
        env: { ...process.env, PATH: `/usr/local/bin/go:${process.env.PATH}` },
        log,
    };
    log.write(`Running 'make' for ${p.name} in '${makeOptions.cwd}'`);
    const makeResult = await spawnLog("make", args, makeOptions);
    if (makeResult.code) {
        if (makeResult.error) {
            log.write(`Make errored for ${p.name}: ${makeResult.error.message}`);
        } else {
            log.write(`Make failed for ${p.name}: ${makeResult.code}`);
        }
    } else {
        log.write(`Successful 'make' invocation for ${p.name}`);
    }
    return makeResult;
}

/**
 * Builder for Go projects that use make.  GoPathHack should be
 * executed before this.
 */
const GoBuilder: Builder = (goalInvocation: GoalInvocation, buildNo: string) => {
    const { configuration, credentials, id, progressLog } = goalInvocation;

    return configuration.sdm.projectLoader.doWithProject({ credentials, id, readOnly: true, cloneOptions: { detachHead: true } },
        async p => {
            const appInfo = await goProjectIdentifier(p);
            const buildResult = await goMake(p, progressLog);
            return { appInfo, buildResult, deploymentUnitFile: undefined };
        },
    );
};

/**
 * Build amd64/linux binary for Docker.
 */
const GoDockerBuild: GoalProjectListenerRegistration = {
    name: "go-make-docker",
    events: [GoalProjectListenerEvent.before],
    listener: (p, gi) => spawnLog("make", ["docker-target"], { cwd: p.baseDir, log: gi.progressLog }),
    pushTest: IsGoMakeDocker,
};

/**
 * Command for incrementing the version patch value in
 * `cmd/version.go` and `Makefile`.
 */
export async function goIncrementPatch(p: Project, log: ProgressLog): Promise<ExecuteGoalResult> {
    const vPath = "cmd/version.go";
    const vFile = await p.getFile(vPath);
    if (!vFile) {
        const msg = `Project does not have '${vPath}' file`;
        log.write(msg);
        return { code: 1, message: msg };
    }
    const vContent = await vFile.getContent();
    const currentVersion = vContent.replace(goExtractVersionRegExp, "$1");
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
    log.write(`Incremented version: ${currentVersion} => ${newVersion}`);
    await vFile.setContent(vContent.replace(goSetVersionRegExp, `$1"${newVersion}"`));
    log.write(`Incremented patch level in '${vPath}' file`);
    const makefilePath = "Makefile";
    const makefileFile = await p.getFile(makefilePath);
    if (!makefileFile) {
        const msg = `Project does not have '${makefilePath}' file`;
        log.write(msg);
        return { code: 1, message: msg };
    }
    await makefileFile.setContent((await makefileFile.getContent()).replace(/^DOCKER_VERSION\s*=.*/m, `DOCKER_VERSION = ${newVersion}`));
    log.write(`Incremented patch level in '${makefilePath}' file`);
    const message = `Incremented patch level: ${currentVersion} => ${newVersion}`;
    log.write(message);
    return { code: 0, message };
}
