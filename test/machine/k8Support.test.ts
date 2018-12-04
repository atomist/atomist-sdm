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
    GitProject,
    InMemoryProject,
} from "@atomist/automation-client";
import {
    RepoContext,
    SdmGoalEvent,
    SoftwareDeliveryMachine,
} from "@atomist/sdm";
import { KubernetesApplicationOptions } from "@atomist/sdm-pack-k8";
import * as assert from "power-assert";
import {
    ingressFromGoal,
    kubernetesDeploymentData,
} from "../../lib/machine/k8Support";

describe("k8Support", () => {

    describe("kubernetesDeploymentData", () => {

        function sdmGen(gp: GitProject): SoftwareDeliveryMachine {
            return {
                projectLoader: {
                    doWithProject: async (params: any, action: (p: GitProject) => Promise<KubernetesApplicationOptions>) => action(gp),
                },
            } as any;
        }
        const context: RepoContext = {
            credentials: "creds",
            id: {},
        } as any;

        it("should provide function that generates Kubernetes deployment data", async () => {
            const p: GitProject = InMemoryProject.of() as any;
            const environment = "testing";
            const sdm: SoftwareDeliveryMachine = {
                configuration: {
                    environment,
                    sdm: sdmGen(p),
                },
            } as any;
            const goal: SdmGoalEvent = {
                environment,
                repo: {
                    name: "rocknroll",
                },
            } as any;
            const d = await kubernetesDeploymentData(sdm)(goal, context);
            assert(d);
            const e = {
                name: "rocknroll",
                environment,
                port: 2866,
                ns: "default",
                replicas: 1,
            };
            assert.deepStrictEqual(d, e);
        });

        it("should set port for Maven project", async () => {
            const p: GitProject = InMemoryProject.of({ path: "pom.xml", content: "" }) as any;
            const environment = "testing";
            const sdm: SoftwareDeliveryMachine = {
                configuration: {
                    environment,
                    sdm: sdmGen(p),
                },
            } as any;
            const goal: SdmGoalEvent = {
                environment,
                repo: {
                    name: "rocknroll",
                },
            } as any;
            const d = await kubernetesDeploymentData(sdm)(goal, context);
            assert(d);
            const e = {
                name: "rocknroll",
                environment,
                port: 8080,
                ns: "default",
                replicas: 1,
            };
            assert.deepStrictEqual(d, e);
        });

        it("should detect staging environment", async () => {
            const p: GitProject = InMemoryProject.of() as any;
            const sdm: SoftwareDeliveryMachine = {
                configuration: {
                    environment: "myk8_testing",
                    sdm: sdmGen(p),
                },
            } as any;
            const goal: SdmGoalEvent = {
                environment: "1-staging",
                repo: {
                    name: "rocknroll",
                },
            } as any;
            const d = await kubernetesDeploymentData(sdm)(goal, context);
            assert(d);
            const e = {
                name: "rocknroll",
                environment: "myk8",
                port: 2866,
                ns: "testing",
                replicas: 1,
            };
            assert.deepStrictEqual(d, e);
        });

        it("should detect production environment", async () => {
            const p: GitProject = InMemoryProject.of() as any;
            const sdm: SoftwareDeliveryMachine = {
                configuration: {
                    environment: "myk8_prod",
                    sdm: sdmGen(p),
                },
            } as any;
            const goal: SdmGoalEvent = {
                environment: "2-prod",
                repo: {
                    name: "rocknroll",
                },
            } as any;
            const d = await kubernetesDeploymentData(sdm)(goal, context);
            assert(d);
            const e = {
                name: "rocknroll",
                environment: "myk8",
                port: 2866,
                ns: "production",
                replicas: 3,
            };
            assert.deepStrictEqual(d, e);
        });

        it("should detect atomist-sdm", async () => {
            const p: GitProject = InMemoryProject.of() as any;
            const sdm: SoftwareDeliveryMachine = {
                configuration: {
                    environment: "myk8_prod",
                    sdm: sdmGen(p),
                },
            } as any;
            const goal: SdmGoalEvent = {
                environment: "2-prod",
                repo: {
                    name: "atomist-sdm",
                },
            } as any;
            const d = await kubernetesDeploymentData(sdm)(goal, context);
            assert(d);
            const e = {
                name: "atomist-sdm",
                environment: "myk8",
                port: 2866,
                ns: "sdm",
                replicas: 3,
            };
            assert.deepStrictEqual(d, e);
        });

        it("should detect atomist-internal-sdm", async () => {
            const p: GitProject = InMemoryProject.of() as any;
            const sdm: SoftwareDeliveryMachine = {
                configuration: {
                    environment: "myk8_prod",
                    sdm: sdmGen(p),
                },
            } as any;
            const goal: SdmGoalEvent = {
                environment: "1-staging",
                repo: {
                    name: "atomist-internal-sdm",
                },
            } as any;
            const d = await kubernetesDeploymentData(sdm)(goal, context);
            assert(d);
            const e = {
                name: "atomist-internal-sdm",
                environment: "myk8",
                port: 2866,
                ns: "sdm-testing",
                replicas: 1,
            };
            assert.deepStrictEqual(d, e);
        });

        it("should provide an ingress", async () => {
            const p: GitProject = InMemoryProject.of() as any;
            const sdm: SoftwareDeliveryMachine = {
                configuration: {
                    environment: "myk8_prod",
                    sdm: sdmGen(p),
                },
            } as any;
            const goal: SdmGoalEvent = {
                environment: "1-staging",
                repo: {
                    name: "card-automation",
                },
            } as any;
            const d = await kubernetesDeploymentData(sdm)(goal, context);
            assert(d);
            const e = {
                name: "card-automation",
                environment: "myk8",
                port: 2866,
                ns: "testing",
                replicas: 1,
                host: "pusher.atomist.services",
                path: "/",
                tlsSecret: "star-atomist-services",
            };
            assert.deepStrictEqual(d, e);
        });

        it("should provide a production ingress", async () => {
            const p: GitProject = InMemoryProject.of() as any;
            const sdm: SoftwareDeliveryMachine = {
                configuration: {
                    environment: "myk8_prod",
                    sdm: sdmGen(p),
                },
            } as any;
            const goal: SdmGoalEvent = {
                environment: "2-prod",
                repo: {
                    name: "intercom-automation",
                },
            } as any;
            const d = await kubernetesDeploymentData(sdm)(goal, context);
            assert(d);
            const e = {
                name: "intercom-automation",
                environment: "myk8",
                port: 2866,
                ns: "production",
                replicas: 3,
                host: "intercom.atomist.com",
                path: "/",
                tlsSecret: "star-atomist-com",
            };
            assert.deepStrictEqual(d, e);
        });

        it("should not use TLS for badge", async () => {
            const p: GitProject = InMemoryProject.of() as any;
            const sdm: SoftwareDeliveryMachine = {
                configuration: {
                    environment: "myk8_prod",
                    sdm: sdmGen(p),
                },
            } as any;
            const goal: SdmGoalEvent = {
                environment: "2-prod",
                repo: {
                    name: "sdm-automation",
                },
            } as any;
            const d = await kubernetesDeploymentData(sdm)(goal, context);
            assert(d);
            const e = {
                name: "sdm-automation",
                environment: "myk8",
                port: 2866,
                ns: "production",
                replicas: 3,
                host: "badge.atomist.com",
                path: "/",
            };
            assert.deepStrictEqual(d, e);
        });

    });

    describe("ingressFromGoal", () => {

        it("should return the production ingress for card-automation", () => {
            const r = "card-automation";
            const n = "production";
            const i = ingressFromGoal(r, n);
            assert(i.host === "pusher.atomist.com");
            assert(i.path === "/");
            assert(i.tlsSecret === "star-atomist-com");
            const s = { name: r, ...i };
            const e = {
                name: r,
                host: "pusher.atomist.com",
                path: "/",
                tlsSecret: "star-atomist-com",
            };
            assert.deepStrictEqual(s, e);
        });

        it("should return the testing ingress for card-automation", () => {
            const r = "card-automation";
            const n = "testing";
            const i = ingressFromGoal(r, n);
            assert(i.host === "pusher.atomist.services");
            assert(i.path === "/");
            assert(i.tlsSecret === "star-atomist-services");
        });

        it("should return undefined", () => {
            const r = "schmard-automation";
            const n = "testing";
            const i = ingressFromGoal(r, n);
            assert(i === undefined);
            // make sure you can spread undefined with no side effect
            const s = { name: r, ...i };
            assert.deepStrictEqual(s, { name: r });
        });

        it("should return .services host for testing intercom-automation", () => {
            const r = "intercom-automation";
            const n = "testing";
            const i = ingressFromGoal(r, n);
            const e = {
                host: "intercom.atomist.services",
                path: "/",
                tlsSecret: "star-atomist-services",
            };
            assert.deepStrictEqual(i, e);
        });

        it("should return .com host for production intercom-automation", () => {
            const r = "intercom-automation";
            const n = "production";
            const i = ingressFromGoal(r, n);
            const e = {
                host: "intercom.atomist.com",
                path: "/",
                tlsSecret: "star-atomist-com",
            };
            assert.deepStrictEqual(i, e);
        });

        it("should return non-TLS .services host for testing sdm-automation", () => {
            const r = "sdm-automation";
            const n = "testing";
            const i = ingressFromGoal(r, n);
            const e = {
                host: "badge.atomist.services",
                path: "/",
            };
            assert.deepStrictEqual(i, e);
        });

        it("should return non-TLS .com host for production sdm-automation", () => {
            const r = "sdm-automation";
            const n = "production";
            const i = ingressFromGoal(r, n);
            const e = {
                host: "badge.atomist.com",
                path: "/",
            };
            assert.deepStrictEqual(i, e);
        });

    });

});
