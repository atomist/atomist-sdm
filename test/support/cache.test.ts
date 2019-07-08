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

import { guid } from "@atomist/automation-client";
import { GoalInvocation } from "@atomist/sdm";
import { Storage } from "@google-cloud/storage";
import * as assert from "assert";
import * as fs from "fs-extra";
import * as stringify from "json-stringify-safe";
import * as os from "os";
import * as path from "path";
import {
    getCacheConfig,
    getCachePath,
    GoogleCloudStorageGoalCacheArchiveStore,
} from "../../lib/support/cache";

describe("support/cache", () => {

    describe("getCacheConfig", () => {

        it("should provide default config", () => {
            const gi: GoalInvocation = {
                configuration: {
                    name: "sweetheart-of-the-rodeo",
                    sdm: {
                    },
                },
                context: {
                    workspaceId: "TH3BY4D5",
                },
            } as any;
            const c = getCacheConfig(gi);
            const e = {
                bucket: "sdm-th3by4d5-sweetheart-of-the-rodeo-goal-cache",
                path: "goal-cache",
            };
            assert.deepStrictEqual(c, e);
        });

        it("should use provided config", () => {
            const gi: GoalInvocation = {
                configuration: {
                    name: "@byrds/sweetheart-of-the-rodeo",
                    sdm: {
                        cache: {
                            bucket: "hickory-wind",
                            enabled: true,
                            path: "lazy/days",
                        },
                    },
                },
                context: {
                    workspaceId: "TH3BY4D5",
                },
            } as any;
            const c = getCacheConfig(gi);
            const e = {
                bucket: "hickory-wind",
                enabled: true,
                path: "lazy/days",
            };
            assert.deepStrictEqual(c, e);
        });

        it("should clean up bucket name", () => {
            const gi: GoalInvocation = {
                configuration: {
                    name: "@Sweetheart/of--the-Rodeo-",
                    sdm: {
                    },
                },
                context: {
                    workspaceId: "TH3BY4D5",
                },
            } as any;
            const c = getCacheConfig(gi);
            const e = {
                bucket: "sdm-th3by4d5-sweetheartof-the-rodeo-goal-cache",
                path: "goal-cache",
            };
            assert.deepStrictEqual(c, e);
        });

    });

    describe("getCachePath", () => {

        it("should return a reasonable path", () => {
            const gi: GoalInvocation = {
                configuration: {
                    name: "@byrds/sweetheart-of-the-rodeo",
                    sdm: {
                        cache: {
                            bucket: "hickory-wind",
                            enabled: true,
                            path: "lazy/days",
                        },
                    },
                },
                goalEvent: {
                    branch: "the-christian-life",
                    repo: {
                        name: "you-aint-goin-nowhere",
                        owner: "YoureStillOnMyMind",
                        providerId: "100yearsfromnow",
                    },
                    sha: "808eddb6016a45091e6d53f12ab8ca2d1cd7fb3e",
                },
                context: {
                    workspaceId: "TH3BY4D5",
                },
            } as any;
            const c = "i-am-a-pilgrim";
            const p = getCachePath(gi, c);
            // tslint:disable-next-line:max-line-length
            const e = "lazy/days/TH3BY4D5/100yearsfromnow/YoureStillOnMyMind/you-aint-goin-nowhere/the-christian-life/i-am-a-pilgrim/808eddb6016a45091e6d53f12ab8ca2d1cd7fb3e-cache.tar.gz";
            assert(p === e);
        });

    });

    describe("GoogleCloudStorageGoalCacheArchiveStore", () => {

        before(function(): void {
            if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
                // tslint:disable-next-line:no-invalid-this
                this.skip();
            }
        });

        const tmpDirs: string[] = [];
        after(async () => {
            try {
                await Promise.all(tmpDirs.map(d => fs.remove(d)));
            } catch (e) { /* ignore */ }
        });

        it("should store, retrive, and delete a cache item", async () => {
            const a = new GoogleCloudStorageGoalCacheArchiveStore();
            const b = "atm-atomist-sdm-goal-cache-production";
            const p = `test-path-${guid()}`;
            const gi: GoalInvocation = {
                configuration: {
                    name: "@byrds/sweetheart-of-the-rodeo",
                    sdm: {
                        cache: {
                            bucket: b,
                            enabled: true,
                            path: p,
                        },
                    },
                },
                context: {
                    workspaceId: "WORKSPACEx",
                },
                goalEvent: {
                    branch: "branchx",
                    repo: {
                        name: "namex",
                        owner: "ownerx",
                        providerId: "providerx",
                    },
                    sha: "shax",
                },
                progressLog: {
                    write: ld => { },
                },
            } as any;
            const c = "classifierx";
            const f = `${p}/WORKSPACEx/providerx/ownerx/namex/branchx/classifierx/shax-cache.tar.gz`;
            const t = path.join(os.tmpdir(), `atomist-sdm-cache-test-${guid()}`);
            await fs.ensureDir(t);
            tmpDirs.push(t);
            const i = path.join(t, `input-${guid()}.tar.gz`);
            await fs.writeFile(i, "Test junk\nNot an actual .tar.gz file\n");
            await a.store(gi, c, i);
            const s = new Storage();
            const ie = await s.bucket(b).file(f).exists();
            assert(ie[0] === true, `Object does not exist: ${stringify(ie)}`);
            const o = path.join(t, `output-${guid()}.tar.gz`);
            await a.retrieve(gi, c, o);
            assert(fs.existsSync(o));
            const oc = await fs.readFile(o, "utf8");
            assert(oc === "Test junk\nNot an actual .tar.gz file\n");
            await a.delete(gi, c);
            const de = await s.bucket(b).file(f).exists();
            assert(de[0] === false, `Object does exists after delete: ${stringify(de)}`);
        }).timeout(20000);

    });

});
