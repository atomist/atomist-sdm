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
import { SdmGoalEvent } from "@atomist/sdm";
import {
    KubernetesApplication,
    KubernetesDeploy,
} from "@atomist/sdm-pack-k8s";
import * as assert from "power-assert";
import {
    addK8sSecret,
    ingressFromGoal,
    kubernetesApplicationData,
} from "../../lib/machine/k8sSupport";

/* tslint:disable:max-file-line-count */

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
                port: 2866,
                ns: "default",
                replicas: 1,
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
                replicas: 1,
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
                port: 2866,
                ns: "testing",
                replicas: 1,
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
                port: 2866,
                ns: "production",
                replicas: 3,
            };
            assert.deepStrictEqual(d, e);
        });

        it("should detect atomist-sdm", async () => {
            const a: KubernetesApplication = {} as any;
            const p: GitProject = InMemoryProject.of() as any;
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
                replicas: 3,
            };
            assert.deepStrictEqual(d, e);
        });

        it("should detect atomist-internal-sdm", async () => {
            const a: KubernetesApplication = {} as any;
            const p: GitProject = InMemoryProject.of() as any;
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
                replicas: 1,
            };
            assert.deepStrictEqual(d, e);
        });

        it("should provide an ingress", async () => {
            const a: KubernetesApplication = {} as any;
            const p: GitProject = InMemoryProject.of() as any;
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
                replicas: 1,
                host: "pusher.atomist.services",
                path: "/",
                tlsSecret: "star-atomist-services",
            };
            assert.deepStrictEqual(d, e);
        });

        it("should provide a production ingress", async () => {
            const a: KubernetesApplication = {} as any;
            const p: GitProject = InMemoryProject.of() as any;
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
                replicas: 3,
                host: "intercom.atomist.com",
                path: "/",
                tlsSecret: "star-atomist-com",
            };
            assert.deepStrictEqual(d, e);
        });

        it("should add secret to k8s-sdm deploy", async () => {
            const a: KubernetesApplication = {} as any;
            const p: GitProject = InMemoryProject.of() as any;
            const g: KubernetesDeploy = {
                sdm: {
                    configuration: {
                        apiKey: "S0M3K3Y",
                        workspaceIds: ["TK421", "WAYAYP"],
                        applicationEvents: {
                            workspaceId: "TK421",
                        },
                        cluster: {
                            enabled: true,
                            workers: 2,
                        },
                        logging: {
                            level: "debug",
                        },
                        statsd: {
                            enabled: true,
                            host: "statsd.default.svc.cluster.local",
                        },
                        logzio: {
                            enabled: true,
                            token: "L0GZ10T0K3N",
                        },
                    },
                },
            } as any;
            const v: SdmGoalEvent = {
                environment: "2-prod",
                fulfillment: {
                    name: "@atomist/k8s-sdm_somewhere",
                },
                repo: {
                    name: "k8s-sdm",
                },
            } as any;
            const d = await kubernetesApplicationData(a, p, g, v);
            assert(d);
            const e = {
                name: "k8s-sdm",
                port: 2866,
                ns: "sdm",
                replicas: 1,
                deploymentSpec: {
                    spec: {
                        template: {
                            spec: {
                                containers: [
                                    {
                                        env: [
                                            {
                                                name: "ATOMIST_CONFIG_PATH",
                                                value: "/opt/atm/client.config.json",
                                            },
                                        ],
                                        volumeMounts: [
                                            {
                                                mountPath: "/opt/atm",
                                                name: "k8s-sdm",
                                                readOnly: true,
                                            },
                                        ],
                                    },
                                ],
                                volumes: [
                                    {
                                        name: "k8s-sdm",
                                        secret: {
                                            defaultMode: 256,
                                            secretName: "k8s-sdm",
                                        },
                                    },
                                ],
                            },
                        },
                    },
                },
                secrets: [
                    {
                        apiVersion: "v1",
                        kind: "Secret",
                        type: "Opaque",
                        metadata: {
                            name: "k8s-sdm",
                        },
                        data: {
                            // tslint:disable-next-line:max-line-length
                            "client.config.json": "eyJuYW1lIjoiQGF0b21pc3QvazhzLXNkbV9zb21ld2hlcmUiLCJhcGlLZXkiOiJTME0zSzNZIiwid29ya3NwYWNlSWRzIjpbIlRLNDIxIiwiV0FZQVlQIl0sImVudmlyb25tZW50Ijoic29tZXdoZXJlIiwiYXBwbGljYXRpb25FdmVudHMiOnsid29ya3NwYWNlSWQiOiJUSzQyMSJ9LCJjbHVzdGVyIjp7ImVuYWJsZWQiOnRydWUsIndvcmtlcnMiOjJ9LCJsb2dnaW5nIjp7ImxldmVsIjoiZGVidWcifSwic3RhdHNkIjp7ImVuYWJsZWQiOnRydWUsImhvc3QiOiJzdGF0c2QuZGVmYXVsdC5zdmMuY2x1c3Rlci5sb2NhbCJ9LCJsb2d6aW8iOnsiZW5hYmxlZCI6dHJ1ZSwidG9rZW4iOiJMMEdaMTBUMEszTiJ9fQ==",
                        },
                    },
                ],
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

        it("should return .services host for testing sdm-automation", () => {
            const r = "sdm-automation";
            const n = "testing";
            const i = ingressFromGoal(r, n);
            const e = {
                host: "badge.atomist.services",
                path: "/",
                tlsSecret: "star-atomist-services",
            };
            assert.deepStrictEqual(i, e);
        });

        it("should return .com host for production sdm-automation", () => {
            const r = "sdm-automation";
            const n = "production";
            const i = ingressFromGoal(r, n);
            const e = {
                host: "badge.atomist.com",
                path: "/",
                tlsSecret: "star-atomist-com",
            };
            assert.deepStrictEqual(i, e);
        });

    });

    describe("addK8sSecret", () => {

        it("should add the configuration secret", () => {
            const a = { name: "k8s-sdm" } as any;
            const g: KubernetesDeploy = {
                sdm: {
                    configuration: {
                        apiKey: "S0M3K3Y",
                        workspaceIds: ["TK421", "WAYAYP"],
                        applicationEvents: {
                            workspaceId: "TK421",
                        },
                        cluster: {
                            enabled: true,
                            workers: 2,
                        },
                        logging: {
                            level: "debug",
                        },
                        statsd: {
                            enabled: true,
                            host: "statsd.default.svc.cluster.local",
                        },
                        logzio: {
                            enabled: true,
                            token: "L0GZ10T0K3N",
                        },
                    },
                },
            } as any;
            const d = addK8sSecret(a, g, "@atomist/k8s-sdm_minikube");
            const e = {
                name: "k8s-sdm",
                deploymentSpec: {
                    spec: {
                        template: {
                            spec: {
                                containers: [
                                    {
                                        env: [
                                            {
                                                name: "ATOMIST_CONFIG_PATH",
                                                value: "/opt/atm/client.config.json",
                                            },
                                        ],
                                        volumeMounts: [
                                            {
                                                mountPath: "/opt/atm",
                                                name: "k8s-sdm",
                                                readOnly: true,
                                            },
                                        ],

                                    },
                                ],
                                volumes: [
                                    {
                                        name: "k8s-sdm",
                                        secret: {
                                            defaultMode: 256,
                                            secretName: "k8s-sdm",
                                        },
                                    },
                                ],
                            },
                        },
                    },
                },
                secrets: [
                    {
                        apiVersion: "v1",
                        kind: "Secret",
                        type: "Opaque",
                        metadata: {
                            name: "k8s-sdm",
                        },
                        data: {
                            // tslint:disable-next-line:max-line-length
                            "client.config.json": "eyJuYW1lIjoiQGF0b21pc3QvazhzLXNkbV9taW5pa3ViZSIsImFwaUtleSI6IlMwTTNLM1kiLCJ3b3Jrc3BhY2VJZHMiOlsiVEs0MjEiLCJXQVlBWVAiXSwiZW52aXJvbm1lbnQiOiJtaW5pa3ViZSIsImFwcGxpY2F0aW9uRXZlbnRzIjp7IndvcmtzcGFjZUlkIjoiVEs0MjEifSwiY2x1c3RlciI6eyJlbmFibGVkIjp0cnVlLCJ3b3JrZXJzIjoyfSwibG9nZ2luZyI6eyJsZXZlbCI6ImRlYnVnIn0sInN0YXRzZCI6eyJlbmFibGVkIjp0cnVlLCJob3N0Ijoic3RhdHNkLmRlZmF1bHQuc3ZjLmNsdXN0ZXIubG9jYWwifSwibG9nemlvIjp7ImVuYWJsZWQiOnRydWUsInRva2VuIjoiTDBHWjEwVDBLM04ifX0=",
                        },
                    },
                ],
            };
            assert.deepStrictEqual(d, e);
        });

        it("should append the configuration as a secret", () => {
            const a: any = {
                image: "atomist/k8s-sdm:1.1.0",
                name: "k8s-sdm",
                ns: "sdm",
                workspaceId: "AT34M1D",
                deploymentSpec: {
                    apiVersion: "apps/v1",
                    kind: "Deployment",
                    metadata: {
                        name: "k8s-sdm",
                    },
                    spec: {
                        replicas: 1,
                        template: {
                            metadata: {
                                name: "k8s-sdm",
                            },
                            spec: {
                                containers: [
                                    {
                                        env: [
                                            {
                                                name: "ATOMIST_GOAL_LAUNCHER",
                                                value: "kubernetes",
                                            },
                                        ],
                                        name: "k8s-sdm",
                                        image: "atomist/k8s-sdm:1.1.0",
                                    },
                                ],
                            },
                        },
                        strategy: {
                            type: "RollingUpdate",
                            rollingUpdate: {
                                maxUnavailable: 0,
                                maxSurge: 1,
                            },
                        },
                    },
                },
                secrets: [
                    {
                        apiVersion: "v1",
                        kind: "Secret",
                        type: "Opaque",
                        metadata: {
                            name: "k9-sdm",
                        },
                        data: {
                            dog: "TWFuJ3MgYmVzdCBmcmllbmQu",
                        },
                    },
                ],
            };
            const g: KubernetesDeploy = {
                sdm: {
                    configuration: {
                        apiKey: "S0M3K3Y",
                        workspaceIds: ["TK421", "WAYAYP"],
                        applicationEvents: {
                            workspaceId: "TK421",
                        },
                        cluster: {
                            enabled: true,
                            workers: 2,
                        },
                        logging: {
                            level: "debug",
                        },
                        statsd: {
                            enabled: true,
                            host: "statsd.default.svc.cluster.local",
                        },
                        logzio: {
                            enabled: true,
                            token: "L0GZ10T0K3N",
                        },
                    },
                },
            } as any;
            const d = addK8sSecret(a, g, "k8s-sdm_disco");
            const e = {
                image: "atomist/k8s-sdm:1.1.0",
                name: "k8s-sdm",
                ns: "sdm",
                workspaceId: "AT34M1D",
                deploymentSpec: {
                    apiVersion: "apps/v1",
                    kind: "Deployment",
                    metadata: {
                        name: "k8s-sdm",
                    },
                    spec: {
                        replicas: 1,
                        template: {
                            metadata: {
                                name: "k8s-sdm",
                            },
                            spec: {
                                containers: [
                                    {
                                        env: [
                                            {
                                                name: "ATOMIST_GOAL_LAUNCHER",
                                                value: "kubernetes",
                                            },
                                            {
                                                name: "ATOMIST_CONFIG_PATH",
                                                value: "/opt/atm/client.config.json",
                                            },
                                        ],
                                        name: "k8s-sdm",
                                        image: "atomist/k8s-sdm:1.1.0",
                                        volumeMounts: [
                                            {
                                                mountPath: "/opt/atm",
                                                name: "k8s-sdm",
                                                readOnly: true,
                                            },
                                        ],

                                    },
                                ],
                                volumes: [
                                    {
                                        name: "k8s-sdm",
                                        secret: {
                                            defaultMode: 256,
                                            secretName: "k8s-sdm",
                                        },
                                    },
                                ],
                            },
                        },
                        strategy: {
                            type: "RollingUpdate",
                            rollingUpdate: {
                                maxUnavailable: 0,
                                maxSurge: 1,
                            },
                        },
                    },
                },
                secrets: [
                    a.secrets[0],
                    {
                        apiVersion: "v1",
                        kind: "Secret",
                        type: "Opaque",
                        metadata: {
                            name: "k8s-sdm",
                        },
                        data: {
                            // tslint:disable-next-line:max-line-length
                            "client.config.json": "eyJuYW1lIjoiazhzLXNkbV9kaXNjbyIsImFwaUtleSI6IlMwTTNLM1kiLCJ3b3Jrc3BhY2VJZHMiOlsiVEs0MjEiLCJXQVlBWVAiXSwiZW52aXJvbm1lbnQiOiJkaXNjbyIsImFwcGxpY2F0aW9uRXZlbnRzIjp7IndvcmtzcGFjZUlkIjoiVEs0MjEifSwiY2x1c3RlciI6eyJlbmFibGVkIjp0cnVlLCJ3b3JrZXJzIjoyfSwibG9nZ2luZyI6eyJsZXZlbCI6ImRlYnVnIn0sInN0YXRzZCI6eyJlbmFibGVkIjp0cnVlLCJob3N0Ijoic3RhdHNkLmRlZmF1bHQuc3ZjLmNsdXN0ZXIubG9jYWwifSwibG9nemlvIjp7ImVuYWJsZWQiOnRydWUsInRva2VuIjoiTDBHWjEwVDBLM04ifX0=",
                        },
                    },
                ],
            };
            assert.deepStrictEqual(d, e);
        });

    });

});
