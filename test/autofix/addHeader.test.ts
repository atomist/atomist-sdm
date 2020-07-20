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

import { PushAwareParametersInvocation } from "@atomist/sdm";
import { InMemoryProject } from "@atomist/sdm/lib/client";
import * as minimatch from "minimatch";
import * as assert from "power-assert";
import {
	AddHeaderParameters,
	addHeaderTransform,
	apacheHeader,
	upsertHeader,
} from "../../lib/autofix/addHeader";

describe("addHeader", () => {
	describe("minimatch", () => {
		it("should match globs like I expect", () => {
			assert(
				minimatch(
					"src/typings/types.ts",
					"src/{typings/types,index}.ts",
				),
			);
			assert(minimatch("src/index.ts", "src/{typings/types,index}.ts"));
			assert(
				!minimatch(
					"src/typings/types.d.ts",
					"src/{typings/types,index}.ts",
				),
			);
			assert(!minimatch("index.ts", "src/{typings/types,index}.ts"));
		});
	});

	describe("upsertHeader", () => {
		it("should add the header at the very top of the file", () => {
			const c = 'import stuff from "stuff";\n\nconst foo = "bar";\n';
			const n = upsertHeader("/*\n * Junk Header\n */\n", c);
			const e =
				'/*\n * Junk Header\n */\n\nimport stuff from "stuff";\n\nconst foo = "bar";\n';
			assert(n === e);
		});

		it("should safely do nothing", () => {
			const c =
				'/*\n * Header\n */\n\nimport stuff from "stuff";\n\nconst foo = "bar";\n';
			const n = upsertHeader("/*\n * Header\n */\n", c);
			assert(n === c);
		});

		it("should add the header replacing empty lines", () => {
			const c =
				'\n\n\n\n\n\nimport stuff from "stuff";\n\nconst foo = "bar";\n';
			const n = upsertHeader("/*\n * Junk Header\n */\n", c);
			const e =
				'/*\n * Junk Header\n */\n\nimport stuff from "stuff";\n\nconst foo = "bar";\n';
			assert(n === e);
		});

		it("should add the header after a sh-bang", () => {
			const c =
				'#!/usr/bin/env ts-node;\nimport stuff from "stuff";\n\nconst foo = "bar";\n';
			const n = upsertHeader("/*\n * Sub Header\n */\n", c);
			const e =
				'#!/usr/bin/env ts-node;\n/*\n * Sub Header\n */\n\nimport stuff from "stuff";\n\nconst foo = "bar";\n';
			assert(n === e);
		});

		it("should replace the current header", () => {
			const c = `/*
 * Copyright © 1892 Natomist, Inc.
 *
 * Licensed under the Restrictive License, get off my lawn.
 */

import * as path from "path";
console.log(path.join(__dirname, "index.ts");
process.exit(2);
`;
			const h = `/*
 * Copyright © 2016 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */
`;
			const n = upsertHeader(h, c);
			const e = `/*
 * Copyright © 2016 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

import * as path from "path";
console.log(path.join(__dirname, "index.ts");
process.exit(2);
`;
			assert(n === e);
		});

		it("should only replace the first comment", () => {
			const c = `/*
 * Copyright © 1892 Natomist, Inc.
 *
 * Licensed under the Restrictive License, get off my lawn.
 */

/*
 * This is just a regular comment.
 */

import * as path from "path";
console.log(path.join(__dirname, "index.ts");
process.exit(2);
`;
			const h = `/*
 * Copyright © 2016 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */
`;
			const n = upsertHeader(h, c);
			const e = `/*
 * Copyright © 2016 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

/*
 * This is just a regular comment.
 */

import * as path from "path";
console.log(path.join(__dirname, "index.ts");
process.exit(2);
`;
			assert(n === e);
		});

		it("should replace the current header after empty lines", () => {
			const c = `

/*
 * Copyright © 1892 Natomist, Inc.
 *
 * Licensed under the Restrictive License, get off my lawn.
 */

import * as path from "path";
console.log(path.join(__dirname, "index.ts");
process.exit(2);
`;
			const h = `/*
 * Copyright © 2016 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */
`;
			const n = upsertHeader(h, c);
			const e = `/*
 * Copyright © 2016 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

import * as path from "path";
console.log(path.join(__dirname, "index.ts");
process.exit(2);
`;
			assert(n === e);
		});

		it("should not replace a file-documentation comment", () => {
			const c = `/**
 * This file does some stuff
 *
 * You should use it.
 */

import * as path from "path";
console.log(path.join(__dirname, "index.ts");
process.exit(2);
`;
			const h = `/*
 * Copyright © 2016 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */
`;
			const n = upsertHeader(h, c);
			const e = `/*
 * Copyright © 2016 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

/**
 * This file does some stuff
 *
 * You should use it.
 */

import * as path from "path";
console.log(path.join(__dirname, "index.ts");
process.exit(2);
`;
			assert.strictEqual(n, e);
		});

		it("should replace the current header after sh-bang", () => {
			const c = `#!/usr/bin/env node
/*
 * Copyright © 1892 Natomist, Inc.
 *
 * Licensed under the Restrictive License, get off my lawn.
 */

import * as path from "path";
console.log(path.join(__dirname, "index.ts");
process.exit(2);
`;
			const h = `/*
 * Copyright © 2016 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */
`;
			const n = upsertHeader(h, c);
			const e = `#!/usr/bin/env node
/*
 * Copyright © 2016 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

import * as path from "path";
console.log(path.join(__dirname, "index.ts");
process.exit(2);
`;
			assert(n === e);
		});

		it("should replace the current header after sh-bang and empty lines", () => {
			const c = `#! /usr/bin/env node

/*
 * Copyright (C) 1892 Natomist, Inc.
 *
 * Licensed under the Restrictive License, get off my lawn.
 */

import * as path from "path";
console.log(path.join(__dirname, "index.ts");
process.exit(2);
`;
			const h = `/*
 * Copyright © 2016 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */
`;
			const n = upsertHeader(h, c);
			const e = `#! /usr/bin/env node
/*
 * Copyright © 2016 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

import * as path from "path";
console.log(path.join(__dirname, "index.ts");
process.exit(2);
`;
			assert(n === e);
		});

		it("should update the date in the header", () => {
			const c = `/*
 * Copyright © 1763 Atomist, Inc.
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

import * as path from "path";
console.log(path.join(__dirname, "index.ts");
process.exit(2);
`;
			const n = upsertHeader(apacheHeader(), c);
			const y = new Date().getFullYear();
			const e = `/*
 * Copyright © ${y} Atomist, Inc.
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

import * as path from "path";
console.log(path.join(__dirname, "index.ts");
process.exit(2);
`;
			assert(n === e);
		});
	});

	describe("addHeaderTransform", () => {
		it("usually adds the header at the very top of the file", async () => {
			const p = InMemoryProject.of({
				path: "something.ts",
				content: 'import stuff from "stuff";\n\nconst foo = "bar";\n',
			});

			await addHeaderTransform(p, {
				parameters: new AddHeaderParameters(),
			} as any);

			const newContent = (
				await p.findFile("something.ts")
			).getContentSync();

			assert(newContent.startsWith(apacheHeader()));
		});

		it("adds the header after a #! line", async () => {
			const p = InMemoryProject.of({
				path: "something.ts",
				content:
					'#!/usr/bin/env ts-node;\nimport stuff from "stuff";\n\nconst foo = "bar";\n',
			});

			await addHeaderTransform(p, {
				parameters: new AddHeaderParameters(),
			} as any);

			const newContent = (
				await p.findFile("something.ts")
			).getContentSync();

			assert(
				newContent.startsWith(
					"#!/usr/bin/env ts-node;\n" + apacheHeader(),
				),
			);
		});

		it("should update the date in the header", async () => {
			const p = InMemoryProject.of({
				path: "index.ts",
				content: `/*
 * Copyright © 1763 Atomist, Inc.
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

import * as path from "path";
console.log(path.join(__dirname, "index.ts");
process.exit(2);
`,
			});
			await addHeaderTransform(p, {
				parameters: new AddHeaderParameters(),
			} as any);
			const f = await p.getFile("index.ts");
			const n = await f.getContent();
			const y = new Date().getFullYear();
			const e = `/*
 * Copyright © ${y} Atomist, Inc.
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

import * as path from "path";
console.log(path.join(__dirname, "index.ts");
process.exit(2);
`;
			assert(n === e);
		});

		it("should only update changed files", async () => {
			const p = InMemoryProject.of(
				{ path: "index.ts", content: `const kendrick = "lamar";\n` },
				{ path: "something.ts", content: `const foo = "bar";\n` },
			);
			const parameters = new AddHeaderParameters();
			parameters.onlyChangedFiles = true;
			const papi: PushAwareParametersInvocation<AddHeaderParameters> = {
				parameters,
				push: {
					filesChanged: ["something.ts"],
				},
			} as any;
			await addHeaderTransform(p, papi);
			const fi = await p.getFile("index.ts");
			const ci = await fi.getContent();
			assert(ci === `const kendrick = "lamar";\n`);
			const fs = await p.getFile("something.ts");
			const cs = await fs.getContent();
			const y = new Date().getFullYear();
			const e = `/*
 * Copyright © ${y} Atomist, Inc.
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

const foo = "bar";
`;
			assert(cs === e);
		});
	});
});
