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

import { GitHubRepoRef } from "@atomist/automation-client/operations/common/GitHubRepoRef";
import {
    allSatisfied,
    hasFile,
    not,
} from "@atomist/sdm";
import { tagRepo } from "@atomist/sdm-core";
import { DockerOptions } from "@atomist/sdm-pack-docker";
import { DefaultDockerImageNameCreator } from "@atomist/sdm-pack-docker/docker/executeDockerBuild";
import {
    executePublish,
    IsNode,
    nodeBuilder,
    NodeProjectIdentifier,
    NodeProjectVersioner,
    NpmOptions,
    NpmPreparations,
    NpmProgressReporter,
    PackageLockFingerprinter,
    tslintFix,
} from "@atomist/sdm-pack-node";
import { IsMaven } from "@atomist/sdm-pack-spring/lib/maven/pushTests";
import { LogSuppressor } from "@atomist/sdm/api-helper/log/logInterpreters";
import { SoftwareDeliveryMachine } from "@atomist/sdm/api/machine/SoftwareDeliveryMachine";
import { AddAtomistTypeScriptHeader } from "../autofix/addAtomistHeader";
import { AddThirdPartyLicense } from "../autofix/license/thirdPartyLicense";
import { npmDockerfileFix } from "../autofix/npm/dockerfileFix";
import { deleteDistTagOnBranchDeletion } from "../event/deleteDistTagOnBranchDeletion";
import { AutomationClientTagger } from "../support/tagger";
import { TryToUpdateAtomistDependencies } from "../transform/tryToUpdateAtomistDependencies";
import { TryToUpdateAtomistPeerDependencies } from "../transform/tryToUpdateAtomistPeerDependencies";
import { UpdatePackageAuthor } from "../transform/updatePackageAuthor";
import { UpdatePackageVersion } from "../transform/updatePackageVersion";
import {
    AutofixGoal,
    BuildGoal,
    DockerBuildGoal,
    PublishGoal,
    ReleaseDocsGoal,
    ReleaseNpmGoal,
    ReleaseVersionGoal,
    SmokeTestGoal,
    VersionGoal,
} from "./goals";
import {
    DocsReleasePreparations,
    executeReleaseDocs,
    executeReleaseNpm,
    executeReleaseVersion,
    NpmReleasePreparations,
} from "./release";
import { executeSmokeTests } from "./smokeTest";

const NodeDefaultOptions = {
    pushTest: allSatisfied(IsNode, not(IsMaven)),
    logInterpreter: LogSuppressor,
    progressReporter: NpmProgressReporter,
};

/**
 * Add Node.js implementations of goals to SDM.
 *
 * @param sdm Software Delivery machine to modify
 * @return modified software delivery machine
 */
export function addNodeSupport(sdm: SoftwareDeliveryMachine): SoftwareDeliveryMachine {
    const hasPackageLock = hasFile("package-lock.json");

    VersionGoal.with({
        ...NodeDefaultOptions,
        name: "npm-versioner",
        versioner: NodeProjectVersioner,
    });

    AutofixGoal.with(AddAtomistTypeScriptHeader)
        .with(tslintFix)
        .with(AddThirdPartyLicense)
        .with(npmDockerfileFix("npm", "@atomist/cli"));

    BuildGoal.with({
        ...NodeDefaultOptions,
        name: "npm-ci-npm-run-build",
        builder: nodeBuilder(sdm, "npm ci", "npm run build"),
        pushTest: allSatisfied(NodeDefaultOptions.pushTest, hasPackageLock),
    })
        .with({
            ...NodeDefaultOptions,
            name: "npm-i-npm-run-build",
            builder: nodeBuilder(sdm, "npm i", "npm run build"),
            pushTest: allSatisfied(NodeDefaultOptions.pushTest, not(hasPackageLock)),
        });

    PublishGoal.with({
        ...NodeDefaultOptions,
        name: "npm-publish",
        goalExecutor: executePublish(
            NodeProjectIdentifier,
            NpmPreparations,
            sdm.configuration.sdm.npm as NpmOptions,
        ),
    });

    DockerBuildGoal.with({
        ...NodeDefaultOptions,
        name: "npm-docker-build",
        preparations: NpmPreparations,
        imageNameCreator: DefaultDockerImageNameCreator,
        options: {
            ...sdm.configuration.sdm.docker.hub as DockerOptions,
            push: true,
        },
    });

    ReleaseNpmGoal.with({
        ...NodeDefaultOptions,
        name: "npm-release",
        goalExecutor: executeReleaseNpm(
            NodeProjectIdentifier,
            NpmReleasePreparations,
            sdm.configuration.sdm.npm as NpmOptions),
    });

    SmokeTestGoal.with({
        ...NodeDefaultOptions,
        name: "npm-smoke-test",
        goalExecutor: executeSmokeTests({
                team: "AHF8B2MBL",
                org: "sample-sdm-fidelity",
                port: 2867,
            }, new GitHubRepoRef("atomist", "sdm-smoke-test"),
            "nodeBuild",
        ),
    });

    ReleaseDocsGoal.with({
        ...NodeDefaultOptions,
        name: "npm-docs-release",
        goalExecutor: executeReleaseDocs(DocsReleasePreparations),
    });

    ReleaseVersionGoal.with({
        ...NodeDefaultOptions,
        name: "npm-release-version",
        goalExecutor: executeReleaseVersion(NodeProjectIdentifier),
    });

    sdm.addFirstPushListener(tagRepo(AutomationClientTagger))
        .addFingerprinterRegistration(new PackageLockFingerprinter());

    sdm.addEvent(deleteDistTagOnBranchDeletion(
        sdm.configuration.sdm.projectLoader,
        sdm.configuration.sdm.npm as NpmOptions));

    sdm.addCodeTransformCommand(TryToUpdateAtomistDependencies)
        .addCodeTransformCommand(UpdatePackageVersion)
        .addCodeTransformCommand(TryToUpdateAtomistPeerDependencies)
        .addCodeTransformCommand(UpdatePackageAuthor);

    return sdm;
}
