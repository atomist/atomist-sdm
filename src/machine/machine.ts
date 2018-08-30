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

import {
    DoNotSetAnyGoals,
    IsDeployEnabled,
    not,
    SoftwareDeliveryMachine,
    SoftwareDeliveryMachineConfiguration,
    ToDefaultBranch,
    whenPushSatisfies,
} from "@atomist/sdm";
import {
    createSoftwareDeliveryMachine,
    DisableDeploy,
    EnableDeploy,
    HasDockerfile,
    IsInLocalMode,
    NoGoals,
    summarizeGoalsInGitHubStatus,
} from "@atomist/sdm-core";
import {changelogSupport} from "@atomist/sdm-pack-changelog/lib/changelog";
import {
    IsAtomistAutomationClient,
    IsNode,
} from "@atomist/sdm-pack-node";
import {IsMaven} from "@atomist/sdm-pack-spring/lib/maven/pushTests";
import { HasTravisFile } from "@atomist/sdm/api-helper/pushtest/ci/ciPushTests";
import { isSdmEnabled } from "@atomist/sdm/api-helper/pushtest/configuration/configurationTests";
import { gitHubTeamVote } from "@atomist/sdm/api-helper/voter/githubTeamVote";
import {anySatisfied} from "@atomist/sdm/api/mapping/support/pushTestUtils";
import { buildAwareCodeTransforms } from "@atomist/sdm/pack/build-aware-transform";
import { BadgeSupport } from "../command/badge";
import {
    isNamed,
    isTeam,
} from "../support/identityPushTests";
import { MaterialChangeToNodeRepo } from "../support/materialChangeToNodeRepo";
import {addDockerSupport} from "./dockerSupport";
import {addGithubSupport} from "./githubSupport";
import {
    BuildGoals,
    BuildReleaseGoals,
    CheckGoals,
    DockerGoals,
    DockerReleaseGoals,
    KubernetesDeployGoals,
    LocalGoals,
    ReleaseChangelogGoal,
    SimplifiedKubernetesDeployGoals,
    StagingKubernetesDeployGoals,
} from "./goals";
import {addk8Support} from "./k8Support";
import {addMavenSupport} from "./mavenSupport";
import { addNodeSupport } from "./nodeSupport";
import { addTeamPolicies } from "./teamPolicies";

export function machine(configuration: SoftwareDeliveryMachineConfiguration): SoftwareDeliveryMachine {
    const sdm = createSoftwareDeliveryMachine({
        name: "Atomist Software Delivery Machine",
        configuration,
    },

        whenPushSatisfies(not(IsNode))
            .itMeans("Non Node repository")
            .setGoals(DoNotSetAnyGoals),

        whenPushSatisfies(IsNode, IsInLocalMode)
            .itMeans("Node repository in local mode")
            .setGoals(LocalGoals),

        whenPushSatisfies(not(isSdmEnabled(configuration.name)), isTeam("T095SFFBK"))
            .itMeans("Node repository in atomist team that we are already building in atomist-community")
            .setGoals(DoNotSetAnyGoals),

        // Node
        whenPushSatisfies(IsNode, not(MaterialChangeToNodeRepo))
            .itMeans("No Material Change")
            .setGoals(NoGoals),

        whenPushSatisfies(IsNode, HasTravisFile)
            .itMeans("Just Checking")
            .setGoals(CheckGoals),

        // Simplified deployment goal set for atomist-sdm, k8-automation and atomist-internal-sdm; we are skipping
        // testing for these and deploying straight into their respective namespaces
        whenPushSatisfies(IsNode, HasDockerfile, ToDefaultBranch, IsAtomistAutomationClient,
            isNamed("k8-automation", "atomist-sdm", "atomist-internal-sdm"))
            .itMeans("Simplified Deploy")
            .setGoals(SimplifiedKubernetesDeployGoals),

        whenPushSatisfies(IsNode, HasDockerfile, ToDefaultBranch, IsAtomistAutomationClient,
            isNamed("sample-sdm"))
            .itMeans("Staging Deploy")
            .setGoals(StagingKubernetesDeployGoals),

        whenPushSatisfies(anySatisfied(IsNode, IsMaven), HasDockerfile, ToDefaultBranch, IsDeployEnabled)
            .itMeans("Deploy")
            .setGoals(KubernetesDeployGoals),

        whenPushSatisfies(anySatisfied(IsNode, IsMaven), HasDockerfile, ToDefaultBranch)
            .itMeans("Docker Release Build")
            .setGoals(DockerReleaseGoals),

        whenPushSatisfies(anySatisfied(IsNode, IsMaven), HasDockerfile)
            .itMeans("Docker Build")
            .setGoals(DockerGoals),

        whenPushSatisfies(IsNode, not(HasDockerfile), ToDefaultBranch)
            .itMeans("Release Build")
            .setGoals(BuildReleaseGoals),

        whenPushSatisfies(IsNode, not(HasDockerfile))
            .itMeans("Build")
            .setGoals(BuildGoals),
    );

    sdm.addCommand(EnableDeploy)
        .addCommand(DisableDeploy);

    addGithubSupport(sdm);
    addDockerSupport(sdm);
    addk8Support(sdm);
    addMavenSupport(sdm);
    addNodeSupport(sdm);
    addTeamPolicies(sdm);

    sdm.addExtensionPacks(
        changelogSupport(ReleaseChangelogGoal),
        BadgeSupport,
        buildAwareCodeTransforms({ issueRouter: { raiseIssue: async () => { /* intentionally left empty */ }}}),
    );
    sdm.addGoalApprovalRequestVote(gitHubTeamVote("atomist-automation"));

    summarizeGoalsInGitHubStatus(sdm);

    return sdm;
}
