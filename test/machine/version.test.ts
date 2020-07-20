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

import { ProgressLog } from "@atomist/sdm";
import { InMemoryProject } from "@atomist/sdm/lib/client";
import * as assert from "power-assert";
import { fileIncrementPatch } from "../../lib/machine/version";

describe("machine/version", () => {
	describe("fileIncrementPatch", () => {
		it("should increment the patch", async () => {
			const p = InMemoryProject.of({
				path: "VERSION",
				content: "2.7.1828\n",
			});
			const l: ProgressLog = {
				write: () => {
					return;
				},
			} as any;
			const r = await fileIncrementPatch(p, l);
			assert(r.code === 0);
			assert(
				r.message ===
					"Incremented patch level in 'VERSION' file: 2.7.1828 => 2.7.1829",
			);
			const c = await (await p.getFile("VERSION")).getContent();
			const e = "2.7.1829\n";
			assert(c === e);
		});

		it("should fail to find the file", async () => {
			const p = InMemoryProject.of({
				path: "lib/VERSION",
				content: `86.75.309`,
			});
			const l: ProgressLog = {
				write: () => {
					return;
				},
			} as any;
			const r = await fileIncrementPatch(p, l);
			assert(r.code === 1);
			assert(r.message === "Project does not have 'VERSION' file");
		});

		it("should fail to find the version", async () => {
			const p = InMemoryProject.of({ path: "VERSION", content: `` });
			const l: ProgressLog = {
				write: () => {
					return;
				},
			} as any;
			const r = await fileIncrementPatch(p, l);
			assert(r.code === 1);
			assert(
				r.message === "Failed to extract version from 'VERSION' file",
			);
		});

		it("should fail to increment an invalid version", async () => {
			const p = InMemoryProject.of({
				path: "VERSION",
				content: `6.626e-34\n`,
			});
			const l: ProgressLog = {
				write: () => {
					return;
				},
			} as any;
			const r = await fileIncrementPatch(p, l);
			assert(r.code === 1);
			assert(
				r.message ===
					"Failed to increment patch in version '6.626e-34' from 'VERSION' file",
			);
		});
	});
});
