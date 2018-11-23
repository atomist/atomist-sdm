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
    buttonForCommand,
    guid,
} from "@atomist/automation-client";
import {
    allSatisfied,
    anySatisfied,
    DoNotSetAnyGoals,
    gitHubTeamVoter,
    GoalApprovalRequestVote,
    Immaterial,
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
    gitHubGoalStatus,
    goalState,
    IsInLocalMode,
} from "@atomist/sdm-core";
import { buildAwareCodeTransforms } from "@atomist/sdm-pack-build";
import { changelogSupport } from "@atomist/sdm-pack-changelog/lib/changelog";
import { HasDockerfile } from "@atomist/sdm-pack-docker";
import { IssueSupport } from "@atomist/sdm-pack-issue";
import {
    IsAtomistAutomationClient,
    IsNode,
} from "@atomist/sdm-pack-node";
import {
    IsMaven,
    MaterialChangeToJavaRepo,
} from "@atomist/sdm-pack-spring";
import { isSdmEnabled } from "@atomist/sdm/lib/api-helper/pushtest/configuration/configurationTests";
import {
    bold,
    channel,
    codeLine,
    italic,
    url,
} from "@atomist/slack-messages";
import {
    ApprovalCommand,
    CancelApprovalCommand,
} from "../command/approval";
import { BadgeSupport } from "../command/badge";
import { CreateTag } from "../command/tag";
import {
    isNamed,
    isOrgNamed,
    isTeam,
} from "../support/identityPushTests";
import { MaterialChangeToNodeRepo } from "../support/materialChangeToNodeRepo";
import { addDockerSupport } from "./dockerSupport";
import { addGithubSupport } from "./githubSupport";
import {
    build,
    BuildGoals,
    BuildReleaseAndHomebrewGoals,
    BuildReleaseGoals,
    DockerGoals,
    DockerReleaseGoals,
    FixGoals,
    KubernetesDeployGoals,
    LocalGoals,
    SimplifiedKubernetesDeployGoals,
} from "./goals";
import { addHomebrewSupport } from "./homebrewSupport";
import { addMavenSupport } from "./mavenSupport";
import { addNodeSupport } from "./nodeSupport";
import { IsReleaseCommit } from "./release";
import { addTeamPolicies } from "./teamPolicies";

const AtomistHQWorkspace = "T095SFFBK";

export function machine(configuration: SoftwareDeliveryMachineConfiguration): SoftwareDeliveryMachine {
    const sdm = createSoftwareDeliveryMachine({
        name: "Atomist Software Delivery Machine",
        configuration,
    },

        whenPushSatisfies(allSatisfied(isOrgNamed("sdd-manifesto"), isNamed("manifesto")))
            .itMeans("Manifesto repository")
            .setGoals(DoNotSetAnyGoals),

        whenPushSatisfies(not(IsNode))
            .itMeans("Non Node repository")
            .setGoals(DoNotSetAnyGoals),

        whenPushSatisfies(IsReleaseCommit)
            .itMeans("Release commit")
            .setGoals(DoNotSetAnyGoals),

        whenPushSatisfies(IsNode, IsInLocalMode)
            .itMeans("Node repository in local mode")
            .setGoals(LocalGoals),

        whenPushSatisfies(not(isSdmEnabled(configuration.name)), isTeam(AtomistHQWorkspace))
            .itMeans("Disabled repository in atomisthq workspace")
            .setGoals(DoNotSetAnyGoals),

        // Node
        whenPushSatisfies(allSatisfied(IsNode, not(IsMaven)), not(MaterialChangeToNodeRepo))
            .itMeans("No Material Change")
            .setGoals(FixGoals),

        // Maven
        whenPushSatisfies(IsMaven, not(MaterialChangeToJavaRepo))
            .itMeans("No Material Change")
            .setGoals(Immaterial),

        // Simplified deployment goal set for atomist-sdm, k8-automation; we are skipping
        // testing for these and deploying straight into their respective namespaces
        whenPushSatisfies(IsNode, HasDockerfile, ToDefaultBranch, IsAtomistAutomationClient,
            isNamed("k8-automation", "atomist-sdm", "docs-sdm", "manifesto-sdm"))
            .itMeans("Simplified Deploy")
            .setGoals(SimplifiedKubernetesDeployGoals),

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

        whenPushSatisfies(isNamed("cli"), IsNode, not(HasDockerfile), ToDefaultBranch)
            .itMeans("Release Build")
            .setGoals(BuildReleaseAndHomebrewGoals),

        whenPushSatisfies(IsNode, not(HasDockerfile), ToDefaultBranch)
            .itMeans("Release Build")
            .setGoals(BuildReleaseGoals),

        whenPushSatisfies(IsNode, not(HasDockerfile))
            .itMeans("Build")
            .setGoals(BuildGoals),
    );

    sdm.addCommand(EnableDeploy)
        .addCommand(DisableDeploy)
        .addCommand(CreateTag);

    addGithubSupport(sdm);
    addDockerSupport(sdm);
    addMavenSupport(sdm);
    addNodeSupport(sdm);
    addHomebrewSupport(sdm);
    addTeamPolicies(sdm);

    sdm.addExtensionPacks(
        changelogSupport(),
        BadgeSupport,
        buildAwareCodeTransforms({
            buildGoal: build,
            issueCreation: {
                issueRouter: {
                    raiseIssue: async () => { /* intentionally left empty */
                    },
                },
            },
        }),
        goalState(),
        gitHubGoalStatus(),
        IssueSupport,
    );

    sdm.addGoalApprovalRequestVoter(gitHubTeamVoter("atomist-automation"));
    sdm.addGoalApprovalRequestVoter(async gi => {
        if (gi.goal.data) {
            const data = JSON.parse(gi.goal.data);
            if (data.approved) {
                return {
                    vote: GoalApprovalRequestVote.Granted,
                };
            }
        }

        const msgId = guid();
        const msg = slackQuestionMessage("Goal Approval", `Goal ${italic(gi.goal.url ? url(gi.goal.url, gi.goal.name) : gi.goal.name)} on ${
            codeLine(gi.goal.sha.slice(0, 7))} of ${bold(`${gi.goal.repo.owner}/${gi.goal.repo.name}/${gi.goal.branch}`)} requires your confirmation to approve`,
            {
                actions: [buttonForCommand(
                    { text: "Approve" },
                    "ApproveSdmGoalCommand",
                    {
                        goalSetId: gi.goal.goalSetId,
                        goalUniqueName: gi.goal.uniqueName,
                        goalState: gi.goal.state,
                        msgId,
                    }), buttonForCommand(
                        { text: "Cancel" },
                        "CancelApproveSdmGoalCommand",
                        {
                            goalSetId: gi.goal.goalSetId,
                            goalUniqueName: gi.goal.uniqueName,
                            goalState: gi.goal.state,
                            msgId,
                        })],
                footer: `${slackFooter()} | ${gi.goal.goalSetId.slice(0, 7)} | ${channel(gi.goal.approval.channelId)}`,
            });
        await gi.context.messageClient.addressUsers(msg, gi.goal.approval.userId, { id: msgId });
        return {
            vote: GoalApprovalRequestVote.Abstain,
        };
    });

    sdm.addCommand(ApprovalCommand)
        .addCommand(CancelApprovalCommand);

    return sdm;
}
