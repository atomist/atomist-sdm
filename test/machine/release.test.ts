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
    GoalInvocation,
    SdmGoalEvent,
} from "@atomist/sdm";
import * as assert from "assert";
import { releaseOrPreRelease } from "../../lib/machine/release";

describe("release", () => {

    describe("releaseOrPreRelease", () => {

        it("should correctly find milestone tag", () => {
            const goal: SdmGoalEvent = {
                push: {
                    after: {
                        tags: [{ name: "1.0.0-201812921239323" }, { name: "1.0.0-M.1"} ],
                    },
                },
            } as any as SdmGoalEvent;
            const gi: GoalInvocation = {
                sdmGoal: goal,
            } as any as GoalInvocation;

            const version = releaseOrPreRelease("1.0.0", gi);
            assert.strictEqual(version, "1.0.0-M.1");

        });

        it("should correctly find rc tag", () => {
            const goal: SdmGoalEvent = {
                push: {
                    after: {
                        tags: [{ name: "1.0.0-RC.1"} ],
                    },
                },
            } as any as SdmGoalEvent;
            const gi: GoalInvocation = {
                sdmGoal: goal,
            } as any as GoalInvocation;

            const version = releaseOrPreRelease("1.0.0", gi);
            assert.strictEqual(version, "1.0.0-RC.1");

        });

        it("should correctly calculate project version", () => {
            const goal: SdmGoalEvent = {
                push: {
                    after: {
                    },
                },
            } as any as SdmGoalEvent;
            const gi: GoalInvocation = {
                sdmGoal: goal,
            } as any as GoalInvocation;

            const version = releaseOrPreRelease("1.0.0", gi);
            assert.strictEqual(version, "1.0.0");

        });
    });
});
