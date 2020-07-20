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

import { Project } from "@atomist/sdm/lib/client";
import * as appRoot from "app-root-path";
import { addThirdPartyLicenseTransform } from "../../../lib/autofix/license/thirdPartyLicense";

describe("thirdPartyLicense", () => {
	it.skip("should create license file", () => {
		let fc: string;
		return addThirdPartyLicenseTransform()(
			({
				baseDir: appRoot.path,
				addFile: (name: string, content: string) => {
					fc = content;
				},
				getFile: (name: string) => {
					if (name === ".gitattributes") {
						return false;
					}
					return true;
				},
				deleteDirectory: () => "",
				hasDirectory: async () => true,
			} as any) as Project,
			undefined,
		).then(() => {
			// tslint:disable:max-line-length
			assert(
				fc.startsWith(`# \`@atomist/atomist-sdm\`

\`@atomist/atomist-sdm\` is licensed under Apache License 2.0 - [http://www.apache.org/licenses/LICENSE-2.0](http://www.apache.org/licenses/LICENSE-2.0).

This page details all runtime OSS dependencies of \`@atomist/atomist-sdm\`.

## Licenses

### Summary

| License | Count |
|---------|-------|
`),
			);
			assert(
				fc.endsWith(`
## Contact

Please send any questions or inquires to [oss@atomist.com](mailto:oss@atomist.com).

---

Created by [Atomist][atomist].
Need Help?  [Join our Slack team][slack].

[atomist]: https://atomist.com/ (Atomist - Development Automation)
[slack]: https://join.atomist.com/ (Atomist Community Slack)
`),
			);
		});
	}).timeout(1000 * 20);
});
