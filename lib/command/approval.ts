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
    addressEvent,
    AutomationContextAware,
    Parameter,
    Parameters,
    QueryNoCacheOptions,
} from "@atomist/automation-client";
import {
    CommandHandlerRegistration,
    GoalRootType,
    slackFooter,
    slackSuccessMessage,
    slackWarningMessage,
} from "@atomist/sdm";
import {
    bold,
    channel,
    codeLine,
    italic,
    url,
} from "@atomist/slack-messages";
import * as _ from "lodash";
import {
    SdmGoal,
    SdmGoalState,
} from "../typings/types";

@Parameters()
class ApprovalParameters {

    @Parameter({ displayable: false, required: true })
    public goalSetId: string;

    @Parameter({ displayable: false, required: true })
    public goalUniqueName: string;

    @Parameter({ displayable: false, required: true })
    public goalState: SdmGoalState;

    @Parameter({ required: false })
    public msgId: string;

}

export const ApprovalCommand: CommandHandlerRegistration<ApprovalParameters> = {
    name: "ApproveSdmGoalCommand",
    intent: [],
    paramsMaker: ApprovalParameters,
    listener: async ci => {

        const goal = (await ci.context.graphClient.query<SdmGoal.Query, SdmGoal.Variables>({
            name: "SdmGoal",
            variables: {
                goalSetId: [ci.parameters.goalSetId],
                state: [ci.parameters.goalState],
                uniqueName: [ci.parameters.goalUniqueName],
            },
            options: QueryNoCacheOptions,
        })).SdmGoal[0];

        const updatedGoal = _.cloneDeep(goal);
        updatedGoal.ts = Date.now();
        updatedGoal.version = updatedGoal.version + 1;

        const actx: AutomationContextAware = ci.context as any;
        const prov: SdmGoal.Provenance = {
            name: actx.context.operation,
            registration: actx.context.name,
            version: actx.context.version,
            correlationId: actx.context.correlationId,
            ts: Date.now(),
        };
        updatedGoal.provenance.push(prov);

        updatedGoal.data = JSON.stringify({ approved: true });

        await ci.context.messageClient.send(updatedGoal, addressEvent(GoalRootType));
        await ci.context.messageClient.respond(
            slackSuccessMessage(
                "Approve Goal",
                `Successfully approved goal ${italic(goal.url ? url(goal.url, goal.name) : goal.name)} on ${
                codeLine(goal.sha.slice(0, 7))} of ${bold(`${goal.repo.owner}/${goal.repo.name}/${goal.branch}`)}`,
                {
                    footer: `${slackFooter()} | ${goal.goalSet} | ${goal.goalSetId.slice(0, 7)} | ${channel(goal.approval.channelId)}`,
                }),
            {
                id: ci.parameters.msgId,
            });
    },
};

export const CancelApprovalCommand: CommandHandlerRegistration<ApprovalParameters> = {
    name: "CancelApproveSdmGoalCommand",
    intent: [],
    paramsMaker: ApprovalParameters,
    listener: async ci => {

        const goal = (await ci.context.graphClient.query<SdmGoal.Query, SdmGoal.Variables>({
            name: "SdmGoal",
            variables: {
                goalSetId: [ci.parameters.goalSetId],
                state: [ci.parameters.goalState],
                uniqueName: [ci.parameters.goalUniqueName],
            },
            options: QueryNoCacheOptions,
        })).SdmGoal[0];

        const updatedGoal = _.cloneDeep(goal);
        updatedGoal.ts = Date.now();
        updatedGoal.version = updatedGoal.version + 1;

        const actx = ci.context as any as AutomationContextAware;
        const prov: SdmGoal.Provenance = {
            name: actx.context.operation,
            registration: actx.context.name,
            version: actx.context.version,
            correlationId: actx.context.correlationId,
            ts: Date.now(),
        };
        updatedGoal.provenance.push(prov);

        if (ci.parameters.goalState === SdmGoalState.approved) {
            updatedGoal.state = SdmGoalState.waiting_for_approval;
            updatedGoal.approval = undefined;
        } else if (ci.parameters.goalState === SdmGoalState.pre_approved) {
            updatedGoal.state = SdmGoalState.waiting_for_pre_approval;
            updatedGoal.preApproval = undefined;
        }

        await ci.context.messageClient.send(updatedGoal, addressEvent(GoalRootType));
        await ci.context.messageClient.respond(
            slackWarningMessage(
                "Approve Goal",
                `Successfully canceled approval of goal ${italic(goal.url ? url(goal.url, goal.name) : goal.name)} on ${
                codeLine(goal.sha.slice(0, 7))} of ${bold(`${goal.repo.owner}/${goal.repo.name}/${goal.branch}`)} | ${channel(goal.approval.channelId)}`,
                ci.context,
                {
                    footer: `${slackFooter()} | ${goal.goalSet} | ${goal.goalSetId.slice(0, 7)}`,
                }),
            {
                id: ci.parameters.msgId,
            });
    },
};
