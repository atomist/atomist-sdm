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
    allSatisfied,
    ApproveGoalIfErrorComments,
    GoalProjectListenerEvent,
    GoalProjectListenerRegistration,
    LogSuppressor,
    not,
    SoftwareDeliveryMachine,
} from "@atomist/sdm";
import { tagRepo } from "@atomist/sdm-core";
import {
    DockerOptions,
    HasDockerfile,
} from "@atomist/sdm-pack-docker";
import { singleIssuePerCategoryManaging } from "@atomist/sdm-pack-issue";
import {
    configureNpmRc,
    executePublish,
    IsNode,
    nodeBuilder,
    NodeModulesProjectListener,
    NodeProjectIdentifier,
    NodeProjectVersioner,
    NpmCompileProjectListener,
    NpmOptions,
    NpmProgressReporter,
    NpmVersionProjectListener,
    tslintFix,
} from "@atomist/sdm-pack-node";
import { IsMaven } from "@atomist/sdm-pack-spring";
import { AddAtomistTypeScriptHeader } from "../autofix/addAtomistHeader";
import { TypeScriptImports } from "../autofix/imports/importsFix";
import { AddThirdPartyLicense } from "../autofix/license/thirdPartyLicense";
import {
    RenameTest,
    RenameTestFix,
} from "../autofix/test/testNamingFix";
import { UpdateSupportFilesTransform } from "../autofix/updateSupportFiles";
import { deleteDistTagOnBranchDeletion } from "../event/deleteDistTagOnBranchDeletion";
import {
    RunTslint,
    tsLintReviewCategory,
} from "../inspection/tslint";
import {
    isNamed,
    isOrgNamed,
} from "../support/identityPushTests";
import { AutomationClientTagger } from "../support/tagger";
import { RewriteImports } from "../transform/rewriteImports";
import { TryToUpdateAtomistDependencies } from "../transform/tryToUpdateAtomistDependencies";
import { TryToUpdateAtomistPeerDependencies } from "../transform/tryToUpdateAtomistPeerDependencies";
import { TryToUpdateDependency } from "../transform/tryToUpdateDependency";
import { UpdatePackageAuthor } from "../transform/updatePackageAuthor";
import { UpdatePackageVersion } from "../transform/updatePackageVersion";
import {
    autoCodeInspection,
    autofix,
    build,
    dockerBuild,
    productionDeployment,
    productionDeploymentWithApproval,
    publish,
    publishWithApproval,
    releaseDocs,
    releaseNpm,
    releaseVersion,
    stagingDeployment,
    version,
} from "./goals";
import { kubernetesDeploymentData } from "./k8Support";
import {
    DocsReleasePreparations,
    executeReleaseDocs,
    executeReleaseNpm,
    executeReleaseVersion,
    NpmReleasePreparations,
} from "./release";

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

    version.with({
        ...NodeDefaultOptions,
        name: "npm-versioner",
        versioner: NodeProjectVersioner,
    });

    autofix.with(AddAtomistTypeScriptHeader)
        .with(tslintFix)
        .with(TypeScriptImports)
        .with(RenameTestFix)
        .with(AddThirdPartyLicense)
        .withProjectListener(npmRcProjectListener(sdm.configuration.sdm.npm as NpmOptions))
        .withProjectListener(NodeModulesProjectListener);

    build.with({
        ...NodeDefaultOptions,
        name: "npm-run-build",
        builder: nodeBuilder({ command: "npm", args: ["run", "compile"] }, { command: "npm", args: ["test"] }),
        pushTest: NodeDefaultOptions.pushTest,
    })
        .withProjectListener(npmRcProjectListener(sdm.configuration.sdm.npm as NpmOptions))
        .withProjectListener(NodeModulesProjectListener);

    autoCodeInspection.with(RunTslint)
        .withListener(singleIssuePerCategoryManaging(tsLintReviewCategory, true, () => true))
        .withListener(ApproveGoalIfErrorComments);

    publish.with({
        ...NodeDefaultOptions,
        name: "npm-publish",
        goalExecutor: executePublish(
            NodeProjectIdentifier,
            sdm.configuration.sdm.npm as NpmOptions,
        ),
    })
        .withProjectListener(npmRcProjectListener(sdm.configuration.sdm.npm as NpmOptions))
        .withProjectListener(NodeModulesProjectListener)
        .withProjectListener(NpmVersionProjectListener)
        .withProjectListener(NpmCompileProjectListener);

    publishWithApproval.with({
        ...NodeDefaultOptions,
        name: "npm-publish",
        goalExecutor: executePublish(
            NodeProjectIdentifier,
            sdm.configuration.sdm.npm as NpmOptions,
        ),
    })
        .withProjectListener(npmRcProjectListener(sdm.configuration.sdm.npm as NpmOptions))
        .withProjectListener(NodeModulesProjectListener)
        .withProjectListener(NpmVersionProjectListener)
        .withProjectListener(NpmCompileProjectListener);

    dockerBuild.with({
        ...NodeDefaultOptions,
        name: "npm-docker-build-global-sdm",
        options: {
            ...sdm.configuration.sdm.docker.t095sffbk as DockerOptions,
            push: true,
            builder: "docker",
            builderArgs: ["--build-args", `NPMRC=${(sdm.configuration.sdm.npm as NpmOptions).npmrc}`],
        },
        pushTest: allSatisfied(IsNode, HasDockerfile, isOrgNamed("atomisthq"), isNamed("global-sdm")),
    }).with({
        ...NodeDefaultOptions,
        name: "npm-docker-build",
        options: {
            ...sdm.configuration.sdm.docker.hub as DockerOptions,
            push: true,
            builder: "docker",
        },
        pushTest: allSatisfied(IsNode, HasDockerfile, not(allSatisfied(isOrgNamed("atomisthq"), isNamed("global-sdm")))),
    })
        .withProjectListener(npmRcProjectListener(sdm.configuration.sdm.npm as NpmOptions))
        .withProjectListener(NodeModulesProjectListener)
        .withProjectListener(NpmVersionProjectListener)
        .withProjectListener(NpmCompileProjectListener);

    releaseNpm.with({
        ...NodeDefaultOptions,
        name: "npm-release",
        goalExecutor: executeReleaseNpm(
            NodeProjectIdentifier,
            NpmReleasePreparations,
            sdm.configuration.sdm.npm as NpmOptions),
    });

    releaseDocs.with({
        ...NodeDefaultOptions,
        name: "npm-docs-release",
        goalExecutor: executeReleaseDocs(DocsReleasePreparations),
    });

    releaseVersion.with({
        ...NodeDefaultOptions,
        name: "npm-release-version",
        goalExecutor: executeReleaseVersion(NodeProjectIdentifier),
    });

    stagingDeployment.withDeployment(kubernetesDeploymentData(sdm));
    productionDeployment.withDeployment(kubernetesDeploymentData(sdm));
    productionDeploymentWithApproval.withDeployment(kubernetesDeploymentData(sdm));

    sdm.addFirstPushListener(tagRepo(AutomationClientTagger));

    sdm.addEvent(deleteDistTagOnBranchDeletion(
        sdm.configuration.sdm.projectLoader,
        sdm.configuration.sdm.npm as NpmOptions));

    sdm.addCodeTransformCommand(TryToUpdateAtomistDependencies)
        .addCodeTransformCommand(TryToUpdateDependency)
        .addCodeTransformCommand(UpdatePackageVersion)
        .addCodeTransformCommand(TryToUpdateAtomistPeerDependencies)
        .addCodeTransformCommand(UpdatePackageAuthor)
        .addCodeTransformCommand(UpdateSupportFilesTransform)
        .addCodeTransformCommand(RewriteImports)
        .addCodeTransformCommand(RenameTest);

    return sdm;
}

function npmRcProjectListener(options: NpmOptions): GoalProjectListenerRegistration {
    return {
        name: "npm configure",
        events: [GoalProjectListenerEvent.before],
        pushTest: IsNode,
        listener: async p => {
            await configureNpmRc(options, p);
        },
    };
}
