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

import { InMemoryProject } from "@atomist/automation-client";
import * as assert from "assert";
import * as fs from "fs-extra";
import * as glob from "glob";
import * as path from "path";
import * as util from "util";
import { SourcesTransform } from "../../lib/transform/sourcesTransform";

describe("SourcesTransform", () => {
    it("should transform", async () => {
        const ignore = ["**/node_modules/**", "**/.git/**"];
        const files = (await util.promisify(glob)("**/*", { nodir: true, ignore })).map(f => ({
            path: f,
            content: fs.readFileSync(f).toString(),
        }));
        const p = InMemoryProject.of(...files);
        (p as any).baseDir = process.cwd();
        await SourcesTransform(p, {} as any);

        assert(await p.hasDirectory("src"));
        assert(await p.hasFile("index.js"));
        assert(await p.hasFile("index.d.ts"));
        assert(await p.hasFile("index.d.ts.map"));
        assert(await p.hasFile("index.js.map"));
        assert(!(await p.hasFile("index.ts")));
        assert(await p.hasFile(path.join("src", "index.ts")));

        assert(await p.hasFile(path.join("lib", "autofix", "imports", "importsFix.js")));
        assert(await p.hasFile(path.join("lib", "autofix", "imports", "importsFix.d.ts")));
        assert(await p.hasFile(path.join("lib", "autofix", "imports", "importsFix.d.ts.map")));
        assert(await p.hasFile(path.join("lib", "autofix", "imports", "importsFix.js.map")));
        assert(await p.hasFile(path.join("src", "lib", "autofix", "imports", "importsFix.ts")));
        assert(!(await p.hasFile(path.join("lib", "autofix", "imports", "importsFix.ts"))));

        const tsMap = (await p.getFile(path.join("lib", "autofix", "imports", "importsFix.d.ts.map"))).getContentSync();
        assert(tsMap.includes(`"../../../src/lib/autofix/imports/importsFix.ts"`));
        const jsMap = (await p.getFile(path.join("lib", "autofix", "imports", "importsFix.js.map"))).getContentSync();
        assert(jsMap.includes(`"../../../src/lib/autofix/imports/importsFix.ts"`));
    });
});
