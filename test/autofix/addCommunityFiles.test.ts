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

import { InMemoryProject } from "@atomist/sdm/lib/client";
import * as appRoot from "app-root-path";
import * as fs from "fs-extra";
import * as path from "path";
import * as assert from "power-assert";
import { addCommunityFilesToProject } from "../../lib/autofix/addCommunityFiles";

describe("addCommunityFilesToProject", () => {
	let codeContent: string;
	let contribContent: string;
	before(async () => {
		codeContent = await fs.readFile(
			path.join(appRoot.path, "CODE_OF_CONDUCT.md"),
			"utf8",
		);
		contribContent = await fs.readFile(
			path.join(appRoot.path, "CONTRIBUTING.md"),
			"utf8",
		);
	});

	it("should add the files to an empty project", async () => {
		const p = InMemoryProject.of();
		await addCommunityFilesToProject(p);
		assert(p.fileExistsSync("CODE_OF_CONDUCT.md"));
		assert(p.fileExistsSync("CONTRIBUTING.md"));
		const fCode = await p.getFile("CODE_OF_CONDUCT.md");
		const fContrib = await p.getFile("CONTRIBUTING.md");
		const cCode = await fCode.getContent();
		const cContrib = await fContrib.getContent();
		assert(cCode === codeContent);
		assert(cContrib === contribContent);
	});

	it("should update the files in a project", async () => {
		const p = InMemoryProject.of(
			{ path: "CODE_OF_CONDUCT.md", content: "Be nice\n" },
			{ path: "CONTRIBUTING.md", content: "Every little bit helps!\n" },
		);
		await addCommunityFilesToProject(p);
		assert(p.fileExistsSync("CODE_OF_CONDUCT.md"));
		assert(p.fileExistsSync("CONTRIBUTING.md"));
		const fCode = await p.getFile("CODE_OF_CONDUCT.md");
		const fContrib = await p.getFile("CONTRIBUTING.md");
		const cCode = await fCode.getContent();
		const cContrib = await fContrib.getContent();
		assert(cCode === codeContent);
		assert(cContrib === contribContent);
	});

	it("should add and update the files in a project", async () => {
		const p = InMemoryProject.of({
			path: "CONTRIBUTING.md",
			content: "Every little bit helps!\n",
		});
		await addCommunityFilesToProject(p);
		assert(p.fileExistsSync("CODE_OF_CONDUCT.md"));
		assert(p.fileExistsSync("CONTRIBUTING.md"));
		const fCode = await p.getFile("CODE_OF_CONDUCT.md");
		const fContrib = await p.getFile("CONTRIBUTING.md");
		const cCode = await fCode.getContent();
		const cContrib = await fContrib.getContent();
		assert(cCode === codeContent);
		assert(cContrib === contribContent);
	});

	it("should effectively do nothing", async () => {
		const p = InMemoryProject.of(
			{ path: "CODE_OF_CONDUCT.md", content: codeContent },
			{ path: "CONTRIBUTING.md", content: contribContent },
		);
		await addCommunityFilesToProject(p);
		assert(p.fileExistsSync("CODE_OF_CONDUCT.md"));
		assert(p.fileExistsSync("CONTRIBUTING.md"));
		const fCode = await p.getFile("CODE_OF_CONDUCT.md");
		const fContrib = await p.getFile("CONTRIBUTING.md");
		const cCode = await fCode.getContent();
		const cContrib = await fContrib.getContent();
		assert(cCode === codeContent);
		assert(cContrib === contribContent);
	});
});
