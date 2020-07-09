/*
 * Copyright © 2020 Atomist, Inc.
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

import { SdmGoalEvent } from "@atomist/sdm";
import {
    GitProject,
    InMemoryProject,
} from "@atomist/sdm/lib/client";
import {
    KubernetesApplication,
    KubernetesDeploy,
} from "@atomist/sdm/lib/pack/k8s";
import * as assert from "power-assert";
import {
    ingressFromGoal,
    kubernetesApplicationData,
} from "../../lib/machine/k8sSupport";

describe("k8sSupport", () => {

    describe("kubernetesApplicationData", () => {

        it("should provide function that generates Kubernetes deployment data", async () => {
            const a: KubernetesApplication = {} as any;
            const p: GitProject = InMemoryProject.of() as any;
            const g: KubernetesDeploy = {} as any;
            const v: SdmGoalEvent = {
                environment: "testing",
                repo: {
                    name: "rocknroll",
                },
            } as any;
            const d = await kubernetesApplicationData(a, p, g, v);
            const e = {
                name: "rocknroll",
                port: undefined,
                ns: "default",
                deploymentSpec: {
                    spec: {
                        replicas: 1,
                    },
                },
            };
            assert.deepStrictEqual(d, e);
        });

        it("should set port for Maven project", async () => {
            const a: KubernetesApplication = {} as any;
            const p: GitProject = InMemoryProject.of({ path: "pom.xml", content: "" }) as any;
            const g: KubernetesDeploy = {} as any;
            const v: SdmGoalEvent = {
                environment: "testing",
                repo: {
                    name: "rocknroll",
                },
            } as any;
            const d = await kubernetesApplicationData(a, p, g, v);
            assert(d);
            const e = {
                name: "rocknroll",
                port: 8080,
                ns: "default",
                deploymentSpec: {
                    spec: {
                        replicas: 1,
                    },
                },
            };
            assert.deepStrictEqual(d, e);
        });

        it("should detect staging environment", async () => {
            const a: KubernetesApplication = {} as any;
            const p: GitProject = InMemoryProject.of() as any;
            const g: KubernetesDeploy = {} as any;
            const v: SdmGoalEvent = {
                environment: "1-staging",
                repo: {
                    name: "rocknroll",
                },
            } as any;
            const d = await kubernetesApplicationData(a, p, g, v);
            assert(d);
            const e = {
                name: "rocknroll",
                port: undefined,
                ns: "testing",
                deploymentSpec: {
                    spec: {
                        replicas: 1,
                    },
                },
            };
            assert.deepStrictEqual(d, e);
        });

        it("should detect production environment", async () => {
            const a: KubernetesApplication = {} as any;
            const p: GitProject = InMemoryProject.of() as any;
            const g: KubernetesDeploy = {} as any;
            const v: SdmGoalEvent = {
                environment: "2-prod",
                repo: {
                    name: "rocknroll",
                },
            } as any;
            const d = await kubernetesApplicationData(a, p, g, v);
            assert(d);
            const e = {
                name: "rocknroll",
                port: undefined,
                ns: "production",
                deploymentSpec: {
                    spec: {
                        replicas: 2,
                    },
                },
            };
            assert.deepStrictEqual(d, e);
        });

        it("should retain deployment spec", async () => {
            const a: KubernetesApplication = {
                deploymentSpec: {
                    spec: {
                        template: {
                            spec: {
                                containers: [
                                    {
                                        env: [
                                            { name: "HOME", value: "/away" },
                                        ],
                                    },
                                ],
                            },
                        },
                    },
                },
            } as any;
            const p: GitProject = InMemoryProject.of() as any;
            const g: KubernetesDeploy = {} as any;
            const v: SdmGoalEvent = {
                environment: "testing",
                repo: {
                    name: "rocknroll",
                },
            } as any;
            const d = await kubernetesApplicationData(a, p, g, v);
            const e = {
                name: "rocknroll",
                port: undefined,
                ns: "default",
                deploymentSpec: {
                    spec: {
                        replicas: 1,
                        template: {
                            spec: {
                                containers: [
                                    {
                                        env: [
                                            { name: "HOME", value: "/away" },
                                        ],
                                    },
                                ],
                            },
                        },
                    },
                },
            };
            assert.deepStrictEqual(d, e);
        });

        it("should detect atomist-sdm", async () => {
            const a: KubernetesApplication = {} as any;
            const p: GitProject = InMemoryProject.of(
                { path: "package.json", content: '{"dependencies":{"@atomist/automation-client":"*"}}' },
            ) as any;
            const g: KubernetesDeploy = {} as any;
            const v: SdmGoalEvent = {
                environment: "2-prod",
                repo: {
                    name: "atomist-sdm",
                },
            } as any;
            const d = await kubernetesApplicationData(a, p, g, v);
            assert(d);
            const e = {
                name: "atomist-sdm",
                port: 2866,
                ns: "sdm",
                deploymentSpec: {
                    spec: {
                        replicas: 1,
                    },
                },
            };
            assert.deepStrictEqual(d, e);
        });

        it("should detect atomist-internal-sdm", async () => {
            const a: KubernetesApplication = {} as any;
            const p: GitProject = InMemoryProject.of(
                { path: "package.json", content: '{"dependencies":{"@atomist/automation-client":"*"}}' },
            ) as any;
            const g: KubernetesDeploy = {} as any;
            const v: SdmGoalEvent = {
                environment: "1-staging",
                repo: {
                    name: "atomist-internal-sdm",
                },
            } as any;
            const d = await kubernetesApplicationData(a, p, g, v);
            assert(d);
            const e = {
                name: "atomist-internal-sdm",
                port: 2866,
                ns: "sdm-testing",
                deploymentSpec: {
                    spec: {
                        replicas: 1,
                    },
                },
            };
            assert.deepStrictEqual(d, e);
        });

        it("should provide an ingress", async () => {
            const a: KubernetesApplication = {} as any;
            const p: GitProject = InMemoryProject.of(
                { path: "package.json", content: '{"dependencies":{"@atomist/automation-client":"*"}}' },
            ) as any;
            const g: KubernetesDeploy = {} as any;
            const v: SdmGoalEvent = {
                environment: "1-staging",
                repo: {
                    name: "card-automation",
                },
            } as any;
            const d = await kubernetesApplicationData(a, p, g, v);
            assert(d);
            const e = {
                name: "card-automation",
                port: 2866,
                ns: "testing",
                deploymentSpec: {
                    spec: {
                        replicas: 1,
                    },
                },
                ingressSpec: {
                    metadata: {
                        annotations: {
                            "kubernetes.io/ingress.class": "nginx",
                            "nginx.ingress.kubernetes.io/client-body-buffer-size": "1m",
                        },
                    },
                    spec: {
                        rules: [{ host: "pusher.atomist.services" }],
                        tls: [{
                            hosts: ["pusher.atomist.services"],
                            secretName: "atomist-services-tls",
                        }],
                    },
                },
                path: "/",
            };
            assert.deepStrictEqual(d, e);
        });

        it("should provide a production ingress", async () => {
            const a: KubernetesApplication = {} as any;
            const p: GitProject = InMemoryProject.of(
                { path: "package.json", content: '{"dependencies":{"@atomist/automation-client":"*"}}' },
            ) as any;
            const g: KubernetesDeploy = {} as any;
            const v: SdmGoalEvent = {
                environment: "2-prod",
                repo: {
                    name: "intercom-automation",
                },
            } as any;
            const d = await kubernetesApplicationData(a, p, g, v);
            assert(d);
            const e = {
                name: "intercom-automation",
                port: 2866,
                ns: "production",
                deploymentSpec: {
                    spec: {
                        replicas: 2,
                    },
                },
                ingressSpec: {
                    metadata: {
                        annotations: {
                            "kubernetes.io/ingress.class": "nginx",
                            "nginx.ingress.kubernetes.io/client-body-buffer-size": "1m",
                        },
                    },
                    spec: {
                        rules: [{ host: "intercom.atomist.com" }],
                        tls: [{
                            hosts: ["intercom.atomist.com"],
                            secretName: "star-atomist-com",
                        }],
                    },
                },
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
            assert(i.path === "/");
            const s = { name: r, ...i };
            const e = {
                name: r,
                ingressSpec: {
                    metadata: {
                        annotations: {
                            "kubernetes.io/ingress.class": "nginx",
                            "nginx.ingress.kubernetes.io/client-body-buffer-size": "1m",
                        },
                    },
                    spec: {
                        rules: [{ host: "pusher.atomist.com" }],
                        tls: [{
                            hosts: ["pusher.atomist.com"],
                            secretName: "star-atomist-com",
                        }],
                    },
                },
                path: "/",
            };
            assert.deepStrictEqual(s, e);
        });

        it("should return the testing ingress for card-automation", () => {
            const r = "card-automation";
            const n = "testing";
            const i = ingressFromGoal(r, n);
            const e = {
                ingressSpec: {
                    metadata: {
                        annotations: {
                            "kubernetes.io/ingress.class": "nginx",
                            "nginx.ingress.kubernetes.io/client-body-buffer-size": "1m",
                        },
                    },
                    spec: {
                        rules: [{ host: "pusher.atomist.services" }],
                        tls: [{
                            hosts: ["pusher.atomist.services"],
                            secretName: "atomist-services-tls",
                        }],
                    },
                },
                path: "/",
            };
            assert.deepStrictEqual(i, e);
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
                ingressSpec: {
                    metadata: {
                        annotations: {
                            "kubernetes.io/ingress.class": "nginx",
                            "nginx.ingress.kubernetes.io/client-body-buffer-size": "1m",
                        },
                    },
                    spec: {
                        rules: [{ host: "intercom.atomist.services" }],
                        tls: [{
                            hosts: ["intercom.atomist.services"],
                            secretName: "atomist-services-tls",
                        }],
                    },
                },
                path: "/",
            };
            assert.deepStrictEqual(i, e);
        });

        it("should return .com host for production intercom-automation", () => {
            const r = "intercom-automation";
            const n = "production";
            const i = ingressFromGoal(r, n);
            const e = {
                ingressSpec: {
                    metadata: {
                        annotations: {
                            "kubernetes.io/ingress.class": "nginx",
                            "nginx.ingress.kubernetes.io/client-body-buffer-size": "1m",
                        },
                    },
                    spec: {
                        rules: [{ host: "intercom.atomist.com" }],
                        tls: [{
                            hosts: ["intercom.atomist.com"],
                            secretName: "star-atomist-com",
                        }],
                    },
                },
                path: "/",
            };
            assert.deepStrictEqual(i, e);
        });

        it("should return .services host for testing sdm-automation", () => {
            const r = "sdm-automation";
            const n = "testing";
            const i = ingressFromGoal(r, n);
            const e = {
                ingressSpec: {
                    metadata: {
                        annotations: {
                            "kubernetes.io/ingress.class": "nginx",
                            "nginx.ingress.kubernetes.io/client-body-buffer-size": "1m",
                        },
                    },
                    spec: {
                        rules: [{ host: "badge.atomist.services" }],
                        tls: [{
                            hosts: ["badge.atomist.services"],
                            secretName: "atomist-services-tls",
                        }],
                    },
                },
                path: "/",
            };
            assert.deepStrictEqual(i, e);
        });

        it("should return .com host for production sdm-automation", () => {
            const r = "sdm-automation";
            const n = "production";
            const i = ingressFromGoal(r, n);
            const e = {
                ingressSpec: {
                    metadata: {
                        annotations: {
                            "kubernetes.io/ingress.class": "nginx",
                            "nginx.ingress.kubernetes.io/client-body-buffer-size": "1m",
                        },
                    },
                    spec: {
                        rules: [{ host: "badge.atomist.com" }],
                        tls: [{
                            hosts: ["badge.atomist.com"],
                            secretName: "star-atomist-com",
                        }],
                    },
                },
                path: "/",
            };
            assert.deepStrictEqual(i, e);
        });

    });

});
