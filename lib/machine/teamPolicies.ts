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

import { Success } from "@atomist/automation-client";
import {
    PushFields,
    PushImpactListenerInvocation,
    slackWarningMessage,
    SoftwareDeliveryMachine,
    SoftwareDeliveryMachineConfiguration,
} from "@atomist/sdm";
import { truncateCommitMessage } from "@atomist/sdm-core";
import {
    bold,
    codeLine,
} from "@atomist/slack-messages";
import * as _ from "lodash";
import { AddCommunityFiles } from "../autofix/addCommunityFiles";
import {
    autofix,
    pushImpact,
} from "./goals";

export function addTeamPolicies(sdm: SoftwareDeliveryMachine<SoftwareDeliveryMachineConfiguration>): void {

    // Check case of commit message; they should use upper case too
    pushImpact.withListener(async l => {
        const violations = l.push.commits.filter(c => !isUpperCase(c.message) || titleEndsWithPeriod(c.message));
        const screenName = l.push.after?.committer?.person?.chatId?.screenName;
        if (screenName && violations.length > 0) {
            await warnAboutInvalidCommitMessages(sdm, l, violations, screenName);
        }

        return Success;
    });

    autofix.with(AddCommunityFiles);
    // autofix.with(UpdateSupportFilesFix);
}

async function warnAboutInvalidCommitMessages(sdm: SoftwareDeliveryMachine,
                                              pushImpactListenerInvocation: PushImpactListenerInvocation,
                                              commits: PushFields.Commits[],
                                              screenName: string): Promise<void> {
    const msg = slackWarningMessage(
        "Commit Message",
        `Please make sure that your commit messages start with an upper case letter and do not end with a period.

The following ${commits.length > 1 ? "commits" : "commit"} in ${
        bold(`${pushImpactListenerInvocation.push.repo.owner}/${
            pushImpactListenerInvocation.push.repo.name}/${
            pushImpactListenerInvocation.push.branch}`)} ${
        commits.length > 1 ? "don't" : "doesn't"} follow that standard:

${commits.map(c => `${codeLine(c.sha.slice(0, 7))} ${truncateCommitMessage(c.message, pushImpactListenerInvocation.push.repo)}`).join("\n")}`,
        pushImpactListenerInvocation.context, {
        footer: `${sdm.configuration.name}:${sdm.configuration.version}`,
    });
    await pushImpactListenerInvocation.context.messageClient.addressUsers(
        msg,
        screenName,
        {
            id: `team_policies/commit_messages/${pushImpactListenerInvocation.push.after.sha}`,
        });
}

function isUpperCase(message: string | undefined): boolean {
    return message && message.charAt(0) === message.charAt(0).toUpperCase();
}

export function titleEndsWithPeriod(message: string | undefined): boolean {
    return message && message.split("\n")[0].trim().endsWith(".");
}
