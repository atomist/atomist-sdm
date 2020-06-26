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

import { buttonForCommand, guid } from "@atomist/automation-client";
import {
    GoalApprovalRequestVote,
    goals,
    IsDeployEnabled,
    not,
    slackFooter,
    slackQuestionMessage,
    SoftwareDeliveryMachine,
    SoftwareDeliveryMachineConfiguration,
    ToDefaultBranch,
    whenPushSatisfies,
} from "@atomist/sdm";
import {
    createSoftwareDeliveryMachine,
    DisableDeploy,
    EnableDeploy,
    githubGoalStatusSupport,
    goalStateSupport,
    IsInLocalMode,
    k8sGoalSchedulingSupport,
    notificationSupport,
} from "@atomist/sdm-core";
import { HasDockerfile } from "@atomist/sdm-pack-docker";
import { issueSupport } from "@atomist/sdm-pack-issue";
import { IsAtomistAutomationClient, IsNode } from "@atomist/sdm-pack-node";
import { IsMaven, MaterialChangeToJavaRepo } from "@atomist/sdm-pack-spring";
import { isSdmEnabled } from "@atomist/sdm/lib/api-helper/pushtest/configuration/configurationTests";
import { bold, channel, codeLine, italic, url } from "@atomist/slack-messages";
import { ApprovalCommand, CancelApprovalCommand } from "../command/approval";
import { isNamed, isOrgNamed, isTeam, nameMatches } from "../support/identityPushTests";
import { MaterialChangeToNodeRepo } from "../support/materialChangeToNodeRepo";
import { addDockerSupport } from "./dockerSupport";
import { addGithubSupport } from "./githubSupport";
import {
    BuildGoals,
    BuildReleaseGoals,
    CheckGoals,
    DemoKubernetesDeployGoals,
    demoProductionDeploy,
    DockerGoals,
    DockerReleaseAndHomebrewGoals,
    DockerReleaseGoals,
    FixGoals,
    integrationProductionDeploy,
    KubernetesDeployGoals,
    LocalGoals,
    MavenBuildGoals,
    MavenDockerReleaseGoals,
    MultiKubernetesDeployGoals,
    OrgVisualizerKubernetesDeployGoals,
    orgVisualizerProductionDeploy,
    orgVisualizerStagingDeploy,
    productionDeploy,
    productionDeployWithApproval,
    SimplifiedKubernetesDeployGoals,
    stagingDeploy,
} from "./goals";
import { addHomebrewSupport } from "./homebrewSupport";
import {
    kubernetesDeployRegistrationDemo,
    kubernetesDeployRegistrationIntegration,
    kubernetesDeployRegistrationProd,
    kubernetesDeployRegistrationStaging,
    orgVisualizerKubernetesDeployRegistrationProd,
    orgVisualizerKubernetesDeployRegistrationStaging,
} from "./k8sSupport";
import { addMavenSupport } from "./mavenSupport";
import { addNodeSupport } from "./nodeSupport";
import { IsReleaseCommit } from "./release";
import { addFileVersionerSupport } from "./version";

const AtomistHQWorkspace = "T095SFFBK";
const AtomistCustomerWorkspace = "A62C8F8L8";

export function machine(configuration: SoftwareDeliveryMachineConfiguration): SoftwareDeliveryMachine {
    stagingDeploy.with(kubernetesDeployRegistrationStaging);
    orgVisualizerStagingDeploy.with(orgVisualizerKubernetesDeployRegistrationStaging);
    productionDeploy.with(kubernetesDeployRegistrationProd);
    orgVisualizerProductionDeploy.with(orgVisualizerKubernetesDeployRegistrationProd);
    productionDeployWithApproval.with(kubernetesDeployRegistrationProd);
    demoProductionDeploy.with(kubernetesDeployRegistrationDemo);
    integrationProductionDeploy.with(kubernetesDeployRegistrationIntegration);

    const NoGoals = goals("No Goals");

    const sdm = createSoftwareDeliveryMachine(
        {
            name: "Atomist Software Delivery Machine",
            configuration,
        },

        whenPushSatisfies(isOrgNamed("atomist-playground")).setGoals(NoGoals),

        whenPushSatisfies(isOrgNamed("atomist-skills")).setGoals(NoGoals),

        whenPushSatisfies(isOrgNamed("atomist-seeds"), not(nameMatches(/sdm/)))
            .itMeans("Non-Atomist seed")
            .setGoals(NoGoals),

        whenPushSatisfies(isOrgNamed("sdd-manifesto"), isNamed("manifesto", "manifesto-app"))
            .itMeans("Manifesto repository")
            .setGoals(NoGoals),

        whenPushSatisfies(IsReleaseCommit).itMeans("Release commit").setGoals(NoGoals),

        whenPushSatisfies(IsNode, IsInLocalMode).itMeans("Node repository in local mode").setGoals(LocalGoals),

        whenPushSatisfies(isOrgNamed("atomisthq"), isNamed("web-static", "web-app", "web-site"))
            .itMeans("Built by atomist-web-sdm")
            .setGoals(NoGoals),

        whenPushSatisfies(not(isSdmEnabled(configuration.name)), isTeam(AtomistHQWorkspace))
            .itMeans("Disabled repository in atomisthq workspace")
            .setGoals(NoGoals),

        whenPushSatisfies(isTeam(AtomistHQWorkspace), nameMatches(/poc-sdm/))
            .itMeans("POC SDM in atomisthq")
            .setGoals(NoGoals),

        whenPushSatisfies(isTeam(AtomistCustomerWorkspace), nameMatches(/poc-sdm/))
            .itMeans("POC SDM in atomist-customer")
            .setGoals(CheckGoals),

        // Node
        whenPushSatisfies(IsNode, not(IsMaven), not(MaterialChangeToNodeRepo))
            .itMeans("No Material Change")
            .setGoals(FixGoals),

        // Maven
        whenPushSatisfies(IsMaven, not(MaterialChangeToJavaRepo)).itMeans("No Material Change").setGoals(FixGoals),

        whenPushSatisfies(IsMaven, MaterialChangeToJavaRepo, not(ToDefaultBranch))
            .itMeans("Build Java")
            .setGoals(MavenBuildGoals),

        whenPushSatisfies(IsMaven, MaterialChangeToJavaRepo, HasDockerfile, ToDefaultBranch)
            .itMeans("Maven Docker Release Build")
            .setGoals(MavenDockerReleaseGoals),

        // Simplified deployment goal set for atomist-sdm, k8-automation; we are skipping
        // testing for these and deploying straight into their respective namespaces
        whenPushSatisfies(
            IsNode,
            HasDockerfile,
            ToDefaultBranch,
            IsAtomistAutomationClient,
            isNamed("atomist-sdm", "atomist-client-sdm", "atomist-web-sdm", "docs-sdm", "manifesto-sdm", "catalog-sdm"),
        )
            .itMeans("Simplified Deploy")
            .setGoals(SimplifiedKubernetesDeployGoals),

        // Deploy org-visualizer
        whenPushSatisfies(IsNode, HasDockerfile, ToDefaultBranch, IsAtomistAutomationClient, isNamed("aspect-sdm"))
            .itMeans("Deploy")
            .setGoals(OrgVisualizerKubernetesDeployGoals),

        // Deploy k8s-sdm to all the clusters
        whenPushSatisfies(IsNode, HasDockerfile, ToDefaultBranch, IsAtomistAutomationClient, isNamed("k8s-sdm"))
            .itMeans("Multi Cluster Deploy")
            .setGoals(MultiKubernetesDeployGoals),

        // Deploy demo-sdm to demo cluster
        whenPushSatisfies(IsNode, HasDockerfile, ToDefaultBranch, IsAtomistAutomationClient, isNamed("demo-sdm"))
            .itMeans("Demo Cluster Deploy")
            .setGoals(DemoKubernetesDeployGoals),

        whenPushSatisfies(isNamed("cli"), IsNode, ToDefaultBranch)
            .itMeans("CLI Release Build")
            .setGoals(DockerReleaseAndHomebrewGoals),

        whenPushSatisfies(IsNode, HasDockerfile, ToDefaultBranch, IsDeployEnabled)
            .itMeans("Deploy")
            .setGoals(KubernetesDeployGoals),

        whenPushSatisfies(IsNode, HasDockerfile, ToDefaultBranch)
            .itMeans("Docker Release Build")
            .setGoals(DockerReleaseGoals),

        whenPushSatisfies(IsNode, HasDockerfile).itMeans("Docker Build").setGoals(DockerGoals),

        whenPushSatisfies(IsNode, not(HasDockerfile), ToDefaultBranch)
            .itMeans("Release Build")
            .setGoals(BuildReleaseGoals),

        whenPushSatisfies(IsNode, not(HasDockerfile)).itMeans("Build").setGoals(BuildGoals),
    );

    sdm.addCommand(EnableDeploy).addCommand(DisableDeploy);

    addGithubSupport(sdm);
    addDockerSupport(sdm);
    addMavenSupport(sdm);
    addNodeSupport(sdm);
    addHomebrewSupport(sdm);
    addFileVersionerSupport(sdm);

    sdm.addExtensionPacks(
        k8sGoalSchedulingSupport(),
        goalStateSupport({
            cancellation: {
                enabled: true,
            },
        }),
        githubGoalStatusSupport(),
        notificationSupport(),
        issueSupport({
            labelIssuesOnDeployment: true,
            closeCodeInspectionIssuesOnBranchDeletion: {
                enabled: true,
                source: sdm.configuration.name,
            },
        }),
    );

    // sdm.addGoalApprovalRequestVoter(gitHubTeamVoter("atomist-automation"));
    sdm.addGoalApprovalRequestVoter(async gi => {
        if (gi.goal.data) {
            const data = JSON.parse(gi.goal.data);
            if (data.approved) {
                return {
                    vote: GoalApprovalRequestVote.Granted,
                };
            }
        }
        if (!gi.goal.approval) {
            return {
                vote: GoalApprovalRequestVote.Granted,
            };
        }

        const msgId = guid();
        const channelLink = gi.goal.approval.channelId ? ` \u00B7 ${channel(gi.goal.approval.channelId)}` : "";
        const msg = slackQuestionMessage(
            "Goal Approval",
            `Goal ${italic(gi.goal.url ? url(gi.goal.url, gi.goal.name) : gi.goal.name)} on ${codeLine(
                gi.goal.sha.slice(0, 7),
            )} of ${bold(
                `${gi.goal.repo.owner}/${gi.goal.repo.name}/${gi.goal.branch}`,
            )} requires your confirmation to approve`,
            {
                actions: [
                    buttonForCommand({ text: "Approve" }, "ApproveSdmGoalCommand", {
                        goalSetId: gi.goal.goalSetId,
                        goalUniqueName: gi.goal.uniqueName,
                        goalState: gi.goal.state,
                        msgId,
                    }),
                    buttonForCommand({ text: "Cancel" }, "CancelApproveSdmGoalCommand", {
                        goalSetId: gi.goal.goalSetId,
                        goalUniqueName: gi.goal.uniqueName,
                        goalState: gi.goal.state,
                        msgId,
                    }),
                ],
                footer: `${slackFooter()} \u00B7 ${gi.goal.goalSetId.slice(0, 7)}${channelLink}`,
            },
        );
        await gi.context.messageClient.addressUsers(msg, gi.goal.approval.userId, { id: msgId });
        return {
            vote: GoalApprovalRequestVote.Abstain,
        };
    });

    sdm.addCommand(ApprovalCommand).addCommand(CancelApprovalCommand);

    return sdm;
}
