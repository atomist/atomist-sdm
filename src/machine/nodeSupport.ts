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
    BuildGoal,
    hasFile,
    not,
} from "@atomist/sdm";
import {executeVersioner} from "@atomist/sdm-core/internal/delivery/build/local/projectVersioner";
import {VersionGoal} from "@atomist/sdm-core/pack/well-known-goals/commonGoals";
import {tagRepo} from "@atomist/sdm-core/util/github/tagRepo";
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
import { executeBuild } from "@atomist/sdm/api-helper/goal/executeBuild";
import { LogSuppressor } from "@atomist/sdm/api-helper/log/logInterpreters";
import {SoftwareDeliveryMachine} from "@atomist/sdm/api/machine/SoftwareDeliveryMachine";
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
    PublishGoal,
    ReleaseDocsGoal,
    ReleaseNpmGoal,
    ReleaseVersionGoal,
    SmokeTestGoal,
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

    sdm.addGoalImplementation(
        "npm run build",
        BuildGoal,
        executeBuild(sdm.configuration.sdm.projectLoader, nodeBuilder(sdm, "npm ci", "npm run build")),
        {
            ...NodeDefaultOptions,
            pushTest: allSatisfied(NodeDefaultOptions.pushTest, hasPackageLock),
        },
    )
        .addGoalImplementation(
            "npm run build (no package-lock.json)",
            BuildGoal,
            executeBuild(sdm.configuration.sdm.projectLoader, nodeBuilder(sdm, "npm i", "npm run build")),
            {
                ...NodeDefaultOptions,
                pushTest: allSatisfied(NodeDefaultOptions.pushTest, not(hasPackageLock)),
            },
    )
        .addGoalImplementation(
            "nodeVersioner",
            VersionGoal,
            executeVersioner(sdm.configuration.sdm.projectLoader, NodeProjectVersioner),
            NodeDefaultOptions,
    )
        .addGoalImplementation(
            "nodePublish",
            PublishGoal,
            executePublish(sdm.configuration.sdm.projectLoader,
                NodeProjectIdentifier,
                NpmPreparations,
                {
                    ...sdm.configuration.sdm.npm as NpmOptions,
                }),
            NodeDefaultOptions,
    )
        .addGoalImplementation(
            "nodeNpmRelease",
            ReleaseNpmGoal,
            executeReleaseNpm(sdm.configuration.sdm.projectLoader,
                NodeProjectIdentifier,
                NpmReleasePreparations,
                {
                    ...sdm.configuration.sdm.npm as NpmOptions,
                }),
            NodeDefaultOptions,
    )
        .addGoalImplementation(
            "nodeSmokeTest",
            SmokeTestGoal,
            executeSmokeTests(sdm.configuration.sdm.projectLoader, {
                team: "AHF8B2MBL",
                org: "sample-sdm-fidelity",
                port: 2867,
            }, new GitHubRepoRef("atomist", "sdm-smoke-test"),
                "nodeBuild",
            ),
            NodeDefaultOptions,
    )
        .addGoalImplementation(
            "nodeDocsRelease",
            ReleaseDocsGoal,
            executeReleaseDocs(sdm.configuration.sdm.projectLoader, DocsReleasePreparations),
            NodeDefaultOptions,
    )
        .addGoalImplementation(
            "nodeVersionRelease",
            ReleaseVersionGoal,
            executeReleaseVersion(sdm.configuration.sdm.projectLoader, NodeProjectIdentifier),
            NodeDefaultOptions,
    );

    sdm.addAutofix(AddAtomistTypeScriptHeader)
        .addAutofix(tslintFix)
        .addAutofix(AddThirdPartyLicense)
        .addAutofix(npmDockerfileFix("npm", "@atomist/cli"));

    sdm.addNewRepoWithCodeListener(tagRepo(AutomationClientTagger))
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
