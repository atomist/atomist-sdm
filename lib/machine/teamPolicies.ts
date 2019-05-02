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
    HandlerResult,
    Issue,
    ProjectOperationCredentials,
    RemoteRepoRef,
    Success,
} from "@atomist/automation-client";
import {
    PushFields,
    PushImpactListenerInvocation,
    slackWarningMessage,
    SoftwareDeliveryMachine,
    SoftwareDeliveryMachineConfiguration,
} from "@atomist/sdm";
import {
    github,
    truncateCommitMessage,
} from "@atomist/sdm-core";
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

    // Upper case the title of a new issue
    sdm.addNewIssueListener(async l => {
        return upperCaseTitle(l.issue, l.credentials, l.id);
    });

    // Upper case the title of a new pull request
    sdm.addPullRequestListener(async l => {
        return upperCaseTitle(l.pullRequest, l.credentials, l.id);
    });

    // Check case of commit message; they should use upper case too
    pushImpact.withListener(async l => {
        const nonUpperCaseCommits = l.push.commits.filter(c => !isUpperCase(c.message));
        const commitsEndingWithPeriod = l.push.commits.filter(c => c.message.trim().endsWith("."));
        const screenName = _.get(l.push, "after.committer.person.chatId.screenName");
        if (screenName && (nonUpperCaseCommits.length > 0 || commitsEndingWithPeriod.length > 0)) {
            await warnAboutInvalidCommitMessages(sdm, l, nonUpperCaseCommits, screenName);
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

async function upperCaseTitle(issueOrPr: { title?: string, body?: string, number?: number },
                              credentials: string | ProjectOperationCredentials,
                              rr: RemoteRepoRef): Promise<HandlerResult> {
    const title = issueOrPr.title;
    if (!isUpperCase(title)) {
        const newIssue: Issue = {
            title: _.upperFirst(title),
            body: issueOrPr.body,
        };
        await github.updateIssue(credentials, rr, issueOrPr.number, newIssue);
    }
    return Success;
}

function isUpperCase(message: string): boolean {
    return message && message.charAt(0) === message.charAt(0).toUpperCase();
}
