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

import {
    InMemoryProject,
    InMemoryProjectFile,
    Project,
} from "@atomist/automation-client";
import * as assert from "power-assert";
import * as semver from "semver";
import { dependenciesToPeerDependenciesTransform } from "../../lib/transform/dependenciesToPeerDependencies";

describe("dependenciesToPeerDependenciesTransform", () => {

    it("should test semver", () => {
        assert(semver.gt("1.4.1-remove-remote-repo-ref-from.20190417141720", "1.4.1-master.20190503164044"));
        assert(!semver.gt("1.4.1-20190417141720+remove-remote-repo-ref", "1.4.1-20190503164044+master"));
        assert(!semver.gt("1.4.1-20190417141720-remove-remote-repo-ref", "1.4.1-20190503164044-master"));
    });

    it("should rewrite single dependency regex", async () => {
        const pj = {
            dependencies: {
                "@atomist/automation-client": "^1.3.0",
                "@atomist/microgrammar": "1.1.0-master.20190205190919",
                "@atomist/sdm": "1.3.0-master.20190226090409",
                "@atomist/sdm-core": "1.3.0-master.20190227112318",
                "@atomist/sdm-pack-analysis": "0.1.0-master.20190213071419",
                "@atomist/sdm-pack-build": "1.0.4-master.20190110123121",
                "@atomist/sdm-pack-docker": "1.1.0-master.20190213113315",
                "@atomist/sdm-pack-fingerprints": "2.0.0-updates.20190208003156",
                "@atomist/sdm-pack-issue": "1.1.1-master.20190120184619",
                "@atomist/sdm-pack-k8s": "1.3.6-master.20190226122520",
                "@atomist/sdm-pack-node": "1.0.3-master.20190227144724",
                "@kubernetes/client-node": "^0.8.1",
                "@types/git-url-parse": "^9.0.0",
                "@types/package-json": "^4.0.1",
                "@types/request": "^2.48.1",
                "@types/yamljs": "^0.2.30",
                "fs-extra": "^7.0.1",
                "git-url-parse": "^11.1.2",
                "lodash": "^4.17.11",
                "random-word": "^2.0.0",
                "ts-essentials": "^1.0.2",
                "yamljs": "^0.3.0",
            },
            peerDependencies: {
                "@atomist/sdm-pack-spring": "1.1.1-master.20190215050634",
                "@atomist/slack-messages": "^1.1.0",
            },
        };

        const expectedPj = {
            dependencies: {
                "@atomist/microgrammar": "1.1.0-master.20190205190919",
                "@kubernetes/client-node": "^0.8.1",
                "@types/git-url-parse": "^9.0.0",
                "@types/package-json": "^4.0.1",
                "@types/request": "^2.48.1",
                "@types/yamljs": "^0.2.30",
                "fs-extra": "^7.0.1",
                "git-url-parse": "^11.1.2",
                "lodash": "^4.17.11",
                "random-word": "^2.0.0",
                "ts-essentials": "^1.0.2",
                "yamljs": "^0.3.0",
            },
            devDependencies: {
                "@atomist/automation-client": "^1.3.0",
                "@atomist/sdm": "1.3.0-master.20190226090409",
                "@atomist/sdm-core": "1.3.0-master.20190227112318",
                "@atomist/sdm-pack-analysis": "0.1.0-master.20190213071419",
                "@atomist/sdm-pack-build": "1.0.4-master.20190110123121",
                "@atomist/sdm-pack-docker": "1.1.0-master.20190213113315",
                "@atomist/sdm-pack-fingerprints": "2.0.0-updates.20190208003156",
                "@atomist/sdm-pack-issue": "1.1.1-master.20190120184619",
                "@atomist/sdm-pack-k8s": "1.3.6-master.20190226122520",
                "@atomist/sdm-pack-node": "1.0.3-master.20190227144724",
            },
            peerDependencies: {
                "@atomist/automation-client": ">=1.3.0",
                "@atomist/sdm": ">=1.3.0",
                "@atomist/sdm-core": ">=1.3.0",
                "@atomist/sdm-pack-analysis": ">=0.1.0",
                "@atomist/sdm-pack-build": ">=1.0.0",
                "@atomist/sdm-pack-docker": ">=1.1.0",
                "@atomist/sdm-pack-fingerprints": ">=2.0.0",
                "@atomist/sdm-pack-issue": ">=1.1.0",
                "@atomist/sdm-pack-k8s": ">=1.3.0",
                "@atomist/sdm-pack-node": ">=1.0.0",
                "@atomist/sdm-pack-spring": "1.1.1-master.20190215050634",
                "@atomist/slack-messages": "^1.1.0",
            },
        };

        const pjFile = new InMemoryProjectFile("package.json", JSON.stringify(pj, undefined, 2));
        const p = InMemoryProject.from({ repo: "foo", owner: "bar" } as any, pjFile);

        const result: Project = await dependenciesToPeerDependenciesTransform(
            /@atomist\/sdm.*/, /@atomist\/automation-client.*/)(p, undefined, undefined) as any;
        const newPj = JSON.parse((await result.getFile("package.json")).getContentSync());
        assert.strictEqual(newPj.peerDependencies["@atomist/slack-messages"], "^1.1.0");
        assert.strictEqual(newPj.peerDependencies["@atomist/sdm-core"], ">=1.3.0");
        assert(!Object.keys(newPj.dependencies).some(d => /@atomist\/sdm/g.test(d)));
        assert(Object.keys(newPj.dependencies).some(d => /@types\//g.test(d)));

        assert.deepStrictEqual(newPj, expectedPj);
    });

});
