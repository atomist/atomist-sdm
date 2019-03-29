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

import * as assert from "power-assert";
import {
    htmltestLogToReviewComments,
} from "../../lib/machine/webSupport";

/* tslint:disable:max-file-line-count */

describe("machine/webSupport", () => {

    describe("htmltestLogToReviewComments", () => {

        it("should handle nothing", () => {
            const rc = htmltestLogToReviewComments("");
            assert(rc);
            assert(rc.length === 0);
        });

        it("should parse logs into review comments", () => {
            const rc = htmltestLogToReviewComments(`alt attribute missing --- index.html --> /img/Atomist-Mark-Color.png
alt attribute missing --- about.html --> /img/Atomist-Mark-Color.png
alt attribute missing --- pricing.html --> /img/Atomist-Mark-Color.png
alt attribute missing --- get-started.html --> /img/Atomist-Mark-Color.png
alt attribute missing --- github-permissions.html --> /img/Atomist-Mark-Color.png
alt attribute missing --- terms.html --> /img/Atomist-Mark-Color.png
alt attribute missing --- careers.html --> /img/Atomist-Mark-Color.png
alt attribute missing --- resources.html --> /img/Atomist-Mark-Color.png
target does not exist --- run-development-from-slack.html --> img/slack-logo-color.png
target does not exist --- run-development-from-slack.html --> img/slack-own-the-issue%402x.png
target does not exist --- run-development-from-slack.html --> img/slack-whos-committed%402x.png
target does not exist --- run-development-from-slack.html --> img/slack-build-done-yet%402x.png
target does not exist --- run-development-from-slack.html --> img/slack-one-click-pull-request%402x.png
target does not exist --- run-development-from-slack.html --> img/slack-merge-with-ease%402x.png
target does not exist --- run-development-from-slack.html --> img/slack-release-and-deploy%402x.png
alt attribute missing --- run-development-from-slack.html --> /img/Atomist-Mark-Color.png
target does not exist --- kubernetes.html --> img/kubernetes-webinar.png
target does not exist --- kubernetes.html --> img/slack-deployment-approval.png
target does not exist --- kubernetes.html --> img/slack-monitor-alert.png
target does not exist --- kubernetes.html --> img/atomist-handles-config-details.png
target does not exist --- kubernetes.html --> img/atomist-keep-your-deployments-safe.png
alt attribute missing --- kubernetes.html --> /img/Atomist-Mark-Color.png
alt attribute missing --- error-oauth.html --> /img/Atomist-Mark-Color.png
target does not exist --- error-oauth.html --> js/min/scripts-min.jsv=2019.03.16
alt attribute missing --- success-oauth.html --> /img/Atomist-Mark-Color.png
target does not exist --- success-oauth.html --> js/min/scripts-min.jsv=2019.03.16
target does not exist --- spring.html --> img/Atomist-Dashboard-Screenshot-New.png
target does not exist --- spring.html --> img/icon-repo.png
target does not exist --- spring.html --> img/icon-code-inspect.png
target does not exist --- spring.html --> img/icon-terminal.png
target does not exist --- spring.html --> img/icon-laptop-deploy.png
target does not exist --- spring.html --> img/icon-cloud-terminal.png
alt attribute missing --- spring.html --> /img/Atomist-Mark-Color.png
target does not exist --- build-automations.html --> img/Atomist-Automate-Workflow.png
alt attribute missing --- build-automations.html --> /img/Atomist-Mark-Color.png
alt attribute missing --- success-github.html --> /img/Atomist-Mark-Color.png
target does not exist --- success-github.html --> js/min/scripts-min.jsv=2019.03.16
alt attribute missing --- success.html --> /img/Atomist-Mark-Color.png
target does not exist --- success.html --> js/min/scripts-min.jsv=2019.03.16
alt attribute missing --- success-slack.html --> /img/Atomist-Mark-Color.png
target does not exist --- success-slack.html --> js/min/scripts-min.jsv=2019.03.16
alt attribute missing --- success-github-user.html --> /img/Atomist-Mark-Color.png
target does not exist --- success-github-user.html --> js/min/scripts-min.jsv=2019.03.16
alt attribute missing --- developer.html --> /img/Atomist-Mark-Color.png
alt attribute missing --- privacy.html --> /img/Atomist-Mark-Color.png
`);
            assert(rc);
            assert(rc.length === 45);
            assert(rc.every(c => c.category === "htmltest"));
            assert(rc.filter(c => c.subcategory === "alt attribute missing").length === 20);
            assert(rc.filter(c => c.subcategory === "target does not exist").length === 25);
            assert(rc.filter(c => c.subcategory === "alt attribute missing").every(c => c.severity === "warn"));
            assert(rc.filter(c => c.subcategory === "target does not exist").every(c => c.severity === "error"));
            assert(rc.filter(c => c.sourceLocation.path === "kubernetes.html").length === 6);
            assert(rc.filter(c => c.sourceLocation.path === "kubernetes.html").filter(c => c.subcategory === "alt attribute missing").length === 1);
            assert(rc.filter(c => c.sourceLocation.path === "kubernetes.html").filter(c => c.subcategory === "target does not exist").length === 5);
        });

    });

});
