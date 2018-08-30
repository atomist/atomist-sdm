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
    ReleaseTagGoal,
} from "./goals";
import {
    executeReleaseTag,
} from "./release";

import {executeTag} from "@atomist/sdm-core/internal/delivery/build/executeTag";
import {TagGoal} from "@atomist/sdm-core/pack/well-known-goals/commonGoals";
import {LogSuppressor} from "@atomist/sdm/api-helper/log/logInterpreters";
import {SoftwareDeliveryMachine} from "@atomist/sdm/api/machine/SoftwareDeliveryMachine";

/**
 * Add GitHub implementations of goals to SDM.
 *
 * @param sdm Software Delivery machine to modify
 * @return modified software delivery machine
 */
export function addGithubSupport(sdm: SoftwareDeliveryMachine): SoftwareDeliveryMachine {

    sdm.addGoalImplementation(
            "tagRelease",
            ReleaseTagGoal,
            executeReleaseTag(sdm.configuration.sdm.projectLoader),
            {
                logInterpreter: LogSuppressor,
            },
        )
        .addGoalImplementation(
            "tag",
            TagGoal,
            executeTag(sdm.configuration.sdm.projectLoader),
            {
                logInterpreter: LogSuppressor,
            },
        );
    return sdm;
}
