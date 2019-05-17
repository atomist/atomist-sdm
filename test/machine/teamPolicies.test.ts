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
import { titleEndsWithPeriod } from "../../lib/machine/teamPolicies";

describe("machine/teamPolicies", () => {

    describe("titleEndsWithPeriod", () => {

        it("should return false", () => {
            const t = "I am a Scientist";
            assert(!titleEndsWithPeriod(t));
        });

        it("should return true", () => {
            const t = "I am a Scientist.";
            assert(titleEndsWithPeriod(t));
        });

        it("should trim the title", () => {
            const t = `I am a Scientist.

`;
            assert(titleEndsWithPeriod(t));
        });

        it("should only consider the title", () => {
            const t = `Goldheart mountaintop queen directory

It is okay to put a period in the body of the commit
message.`;
            assert(!titleEndsWithPeriod(t));
        });

    });

});
