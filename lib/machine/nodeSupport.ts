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
    AddThirdPartyLicenseAutofix,
    executePublish,
    IsNode,
    nodeBuilder,
    NodeProjectIdentifier,
    NodeProjectVersioner,
    npmAuditInspection,
    NpmCompileProjectListener,
    NpmOptions,
    NpmProgressReporter,
    NpmVersionProjectListener,
    PackageLockUrlRewriteAutofix,
    TslintAutofix,
    TslintInspection,
} from "@atomist/sdm-pack-node";
import {
    CacheScope,
    npmInstallProjectListener,
} from "@atomist/sdm-pack-node/lib/build/npmBuilder";
import { IsMaven } from "@atomist/sdm-pack-spring";
import { AddAtomistTypeScriptHeader } from "../autofix/addAtomistHeader";
import { TypeScriptImports } from "../autofix/imports/importsFix";
import {
    RenameTest,
    RenameTestFix,
} from "../autofix/test/testNamingFix";
import { UpdateSupportFilesTransform } from "../autofix/updateSupportFiles";
import { deleteDistTagOnBranchDeletion } from "../event/deleteDistTagOnBranchDeletion";
import {
    isNamed,
    isOrgNamed,
} from "../support/identityPushTests";
import { AutomationClientTagger } from "../support/tagger";
import { transformToProjectListener } from "../support/transformToProjectListener";
import { dependenciesToPeerDependenciesTransform } from "../transform/dependenciesToPeerDependencies";
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
    demoProductionDeploy,
    dockerBuild,
    globalProductionDeploy,
    globalStagingDeploy,
    productionDeploy,
    productionDeployWithApproval,
    publish,
    publishWithApproval,
    releaseDocs,
    releaseNpm,
    releaseVersion,
    stagingDeploy,
    version,
} from "./goals";
import {
    kubernetesDeployRegistrationDemo,
    kubernetesDeployRegistrationGlobal,
    kubernetesDeployRegistrationProd,
} from "./k8sSupport";
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
        name: "npm-versioner-global-sdm",
        versioner: async (sdmGoal, p, log) => {
            const branch = sdmGoal.branch;
            if (branch === sdmGoal.push.repo.defaultBranch) {
                sdmGoal.branch = "global";
            }
            let v: string;
            try {
                v = await NodeProjectVersioner(sdmGoal, p, log);
            } finally {
                sdmGoal.branch = branch;
            }
            return v;
        },
        pushTest: allSatisfied(IsNode, isOrgNamed("atomisthq"), isNamed("global-sdm")),
    }).with({
        ...NodeDefaultOptions,
        name: "npm-versioner",
        versioner: NodeProjectVersioner,
        pushTest: allSatisfied(IsNode, not(allSatisfied(isOrgNamed("atomisthq"), isNamed("global-sdm")))),
    });

    autofix.with(AddAtomistTypeScriptHeader)
        .with(TslintAutofix)
        .with(TypeScriptImports)
        .with(PackageLockUrlRewriteAutofix)
        .with(RenameTestFix)
        .with(AddThirdPartyLicenseAutofix)
        .withProjectListener(npmInstallProjectListener({ scope: CacheScope.Repository }));

    build.with({
        ...NodeDefaultOptions,
        name: "npm-run-build",
        builder: nodeBuilder({ command: "npm", args: ["run", "compile"] }, { command: "npm", args: ["test"] }),
        pushTest: NodeDefaultOptions.pushTest,
    })
        .withProjectListener(npmInstallProjectListener({ scope: CacheScope.Repository }));

    autoCodeInspection.with(TslintInspection)
        .with(npmAuditInspection())
        .withProjectListener(npmInstallProjectListener({ scope: CacheScope.Repository }))
        .withListener(singleIssuePerCategoryManaging(sdm.configuration.name, true, () => true))
        .withListener(ApproveGoalIfErrorComments);

    publish.with({
        ...NodeDefaultOptions,
        name: "npm-publish",
        goalExecutor: executePublish(
            NodeProjectIdentifier,
            sdm.configuration.sdm.npm as NpmOptions,
        ),
    })
        .withProjectListener(transformToProjectListener(
            dependenciesToPeerDependenciesTransform(
                /@atomist\/sdm.*/, /@atomist\/automation-client.*/),
            "package.json rewrite",
            allSatisfied(IsNode, isOrgNamed("atomist"), isNamed("uhura"))))
        .withProjectListener(npmInstallProjectListener({ scope: CacheScope.Repository }))
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
        .withProjectListener(transformToProjectListener(
            dependenciesToPeerDependenciesTransform(
                /@atomist\/sdm.*/, /@atomist\/automation-client.*/),
            "package.json rewrite",
            allSatisfied(IsNode, isOrgNamed("atomist"), isNamed("uhura"))))
        .withProjectListener(npmInstallProjectListener({ scope: CacheScope.Repository }))
        .withProjectListener(NpmVersionProjectListener)
        .withProjectListener(NpmCompileProjectListener);

    dockerBuild.with({
        ...NodeDefaultOptions,
        name: "npm-docker-build-global-sdm",
        options: {
            ...sdm.configuration.sdm.docker.t095sffbk as DockerOptions,
            push: true,
            builder: "docker",
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
        .withProjectListener(npmInstallProjectListener({ scope: CacheScope.Repository }))
        .withProjectListener(NpmVersionProjectListener)
        .withProjectListener(NpmCompileProjectListener);

    stagingDeploy.with(kubernetesDeployRegistrationProd);
    productionDeploy.with(kubernetesDeployRegistrationProd);
    productionDeployWithApproval.with(kubernetesDeployRegistrationProd);
    globalStagingDeploy.with(kubernetesDeployRegistrationGlobal);
    globalProductionDeploy.with(kubernetesDeployRegistrationGlobal);
    demoProductionDeploy.with(kubernetesDeployRegistrationDemo);

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
