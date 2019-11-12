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
    GitProject,
    logger,
} from "@atomist/automation-client";
import {
    ProductionEnvironment,
    SdmGoalEvent,
    StagingEnvironment,
} from "@atomist/sdm";
import {
    KubernetesApplication,
    KubernetesDeploy,
} from "@atomist/sdm-pack-k8s";
import { IsAtomistAutomationClient } from "@atomist/sdm-pack-node";
import { IsMaven } from "@atomist/sdm-pack-spring";

export const kubernetesDeployRegistrationStaging = {
    name: "@atomist/k8s-sdm_k8s-internal-staging",
    applicationData: kubernetesApplicationData,
};
export const kubernetesDeployRegistrationProd = {
    name: "@atomist/k8s-sdm_k8s-internal-production",
    applicationData: kubernetesApplicationData,
};
export const orgVisualizerKubernetesDeployRegistrationStaging = {
    name: "@atomist/k8s-sdm_k8s-internal-staging",
    applicationData: orgVisualizerJobKubernetesApplicationData,
};
export const orgVisualizerKubernetesDeployRegistrationProd = {
    name: "@atomist/k8s-sdm_k8s-internal-production",
    applicationData: orgVisualizerJobKubernetesApplicationData,
};
export const kubernetesDeployRegistrationDemo = {
    name: "@atomist/k8s-sdm_k8s-internal-demo",
    applicationData: kubernetesApplicationData,
};
export const kubernetesDeployRegistrationIntegration = {
    name: "@atomist/k8s-sdm_k8s-internal-integration",
    applicationData: kubernetesApplicationData,
};

/**
 * Augment default Kubernetes application object with specifics for
 * the provided deploy goal event.
 */
export async function kubernetesApplicationData(
    app: KubernetesApplication,
    p: GitProject,
    goal: KubernetesDeploy,
    goalEvent: SdmGoalEvent,
): Promise<KubernetesApplication> {

    const name = goalEvent.repo.name;
    const ns = namespaceFromGoal(goalEvent);
    let port: number;
    if (await IsMaven.predicate(p)) {
        port = 8080;
    } else if (await IsAtomistAutomationClient.predicate(p)) {
        port = 2866;
    }
    let replicas = 1;
    if (ns === "production") {
        if (name === "lifecycle-automation") {
            replicas = 20;
        } else if (name === "aspect-sdm") {
            replicas = 10;
        } else {
            replicas = 3;
        }
    } else if (ns === "sdm" && name === "atomist-sdm") {
        replicas = 3;
    }
    const ingress = ingressFromGoal(name, ns);
    const baseApp = {
        ...app,
        name,
        ns,
        port,
        replicas,
        ...ingress,
    };
    return baseApp;
}

/**
 * Augment default Kubernetes application object used for 2nd org-visualizer deployment in
 * batch job mode
 */
export async function orgVisualizerJobKubernetesApplicationData(
    app: KubernetesApplication,
    p: GitProject,
    goal: KubernetesDeploy,
    goalEvent: SdmGoalEvent,
): Promise<KubernetesApplication> {

    const name = `${goalEvent.repo.name}-job`;
    const ns = namespaceFromGoal(goalEvent);
    const port = 2866;
    let replicas = 1;
    if (ns === "production") {
        replicas = 10;
    }

    app.deploymentSpec.spec.template.spec.containers[0].env.push({ name: "ATOMIST_ORG_VISUALIZER_MODE", value: "job" });

    const baseApp = {
        ...app,
        name,
        ns,
        port,
        replicas,
    };
    return baseApp;
}

/**
 * Determine deploy namespace from goal event.
 *
 * @param goalEvent SDM goal event for this deploy.
 * @return Namespace to deploy this app to.
 */
function namespaceFromGoal(goalEvent: SdmGoalEvent): string {
    const name = goalEvent.repo.name;
    if (name === "atomist-internal-sdm") {
        if (goalEvent.environment === StagingEnvironment.replace(/\/$/, "")) {
            return "sdm-testing";
        } else if (goalEvent.environment === ProductionEnvironment.replace(/\/$/, "")) {
            return "sdm";
        }
    } else if (/-sdm$/.test(name) && name !== "sample-sdm" && name !== "spring-sdm" && name !== "aspect-sdm") {
        return "sdm";
    } else if (name === "k8vent") {
        return "k8vent";
    } else if (goalEvent.environment === StagingEnvironment.replace(/\/$/, "")) {
        return "testing";
    } else if (goalEvent.environment === ProductionEnvironment.replace(/\/$/, "")) {
        return "production";
    }
    logger.debug(`Unmatched goal.environment using default namespace: ${goalEvent.environment}`);
    return "default";
}

/**
 * Determine if this deploy requires an ingress, returning it if is
 * does.
 *
 * @param repo Name of repository.
 * @param ns Kubernetes namespace where app will be deployed.
 * @return Object with ingress-related properties of KubernetesApplication populated or `undefined`.
 */
export function ingressFromGoal(repo: string, ns: string): Partial<KubernetesApplication> | undefined {
    let host: string;
    let path: string;
    const ingressSpec = {
        metadata: {
            annotations: {
                "kubernetes.io/ingress.class": "nginx",
                "nginx.ingress.kubernetes.io/client-body-buffer-size": "1m",
            },
        },
    };
    const tail = (ns === "production") ? "com" : "services";
    if (repo === "card-automation") {
        host = "pusher";
        path = "/";
    } else if (repo === "sdm-automation") {
        host = "badge";
        path = "/";
    } else if (repo === "intercom-automation") {
        host = "intercom";
        path = "/";
    } else if (repo === "rolar") {
        host = "rolar";
        path = "/";
    } else if (repo === "aspect-sdm") {
        host = "aspect";
        path = "/";
    } else {
        return undefined;
    }
    return {
        host: `${host}.atomist.${tail}`,
        ingressSpec,
        path,
        tlsSecret: `star-atomist-${tail}`,
    };
}
