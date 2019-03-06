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
    Configuration,
    GitProject,
    logger,
} from "@atomist/automation-client";
import {
    ProductionEnvironment,
    SdmGoalEvent,
    StagingEnvironment,
} from "@atomist/sdm";
import {
    encodeSecret,
    KubernetesApplication,
    KubernetesDeploy,
} from "@atomist/sdm-pack-k8s";
import { IsMaven } from "@atomist/sdm-pack-spring";
import * as stringify from "json-stringify-safe";
import * as _ from "lodash";

export const kubernetesDeployRegistrationProd = {
    name: "@atomist/k8s-sdm_gke-int-production",
    applicationData: kubernetesApplicationData,
};
export const kubernetesDeployRegistrationGlobal = {
    name: "@atomist/k8s-sdm_gke-customer-global",
    applicationData: kubernetesApplicationData,
};
export const kubernetesDeployRegistrationDemo = {
    name: "@atomist/k8s-sdm_gke-int-demo",
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
    const port = (await IsMaven.predicate(p)) ? 8080 : 2866;
    let replicas = 1;
    if (ns === "production") {
        replicas = 3;
    } else if (ns === "sdm" && (name === "atomist-sdm" || name === "global-sdm")) {
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
    return (name === "k8s-sdm") ? addK8sSecret(baseApp, goal, goalEvent.fulfillment.name) : baseApp;
}

/**
 * Determine deploy namespace from goal event.
 *
 * @param goalEvent SDM goal event for this deploy.
 * @return Namespace to deploy this app to.
 */
function namespaceFromGoal(goalEvent: SdmGoalEvent): string {
    const name = goalEvent.repo.name;
    if (name === "atomist-internal-sdm" || name === "global-sdm") {
        if (goalEvent.environment === StagingEnvironment.replace(/\/$/, "")) {
            return "sdm-testing";
        } else if (goalEvent.environment === ProductionEnvironment.replace(/\/$/, "")) {
            return "sdm";
        }
    } else if (/-sdm$/.test(name) && name !== "sample-sdm" && name !== "spring-sdm") {
        return "sdm";
    } else if (goalEvent.environment === StagingEnvironment.replace(/\/$/, "")) {
        return "testing";
    } else if (goalEvent.environment === ProductionEnvironment.replace(/\/$/, "")) {
        return "production";
    }
    logger.debug(`Unmatched goal.environment using default namespace: ${goalEvent.environment}`);
    return "default";
}

export interface Ingress {
    host: string;
    path: string;
    tlsSecret?: string;
}

/**
 * Determine if this deploy requires an ingress, returning it if is
 * does.
 *
 * @param repo Name of repository.
 * @param ns Kubernetes namespace where app will be deployed.
 * @return Object with ingress-related properties of KubernetesApplication populated or `undefined`.
 */
export function ingressFromGoal(repo: string, ns: string): Ingress | undefined {
    let host: string;
    let path: string;
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
    } else {
        return undefined;
    }
    return {
        host: `${host}.atomist.${tail}`,
        path,
        tlsSecret: `star-atomist-${tail}`,
    };
}

/**
 * Create the an SDM confiugration and add it as a secret in the
 * application data.  Needed configuration properties will be selected
 * from `goal.sdm.configuration`.
 *
 * The configuration will then be converted into a Kubernetes secret
 * and added to the application data.  The secret name will be
 * `app.name` and the key in the secret data containing the encoded
 * configuration will be `client.config.json`.
 *
 * The proper secret configuration will be added to the `app.deploymentSpec`.
 *
 * @param app Current value of application data
 * @param config the user configuration.
 * @param sdmName Name this k8s-sdm should register as.
 * @return Kubernetes application data with SDM configuration as secret.
 */
export function addK8sSecret(app: KubernetesApplication, goal: KubernetesDeploy, sdmName: string): KubernetesApplication {
    const secretApp = _.merge({ deploymentSpec: { spec: { template: { spec: { containers: [{}] } } } } }, app);

    const config: Configuration = {
        apiKey: goal.sdm.configuration.apiKey,
        applicationEvents: goal.sdm.configuration.applicationEvents,
        cluster: {
            enabled: true,
            workers: 2,
        },
        environment: sdmName.split("_")[1] || sdmName,
        logging: {
            level: "debug",
        },
        logzio: goal.sdm.configuration.logzio,
        name: sdmName,
        statsd: {
            enabled: _.get(goal, "sdm.configuration.statsd.enabled", false),
            host: _.get(goal, "sdm.configuration.statsd.host", undefined),
        },
        workspaceIds: goal.sdm.configuration.workspaceIds,
    };
    const secretData: { [key: string]: string } = {};
    const sdmSecretConfigKey = "client.config.json";
    secretData[sdmSecretConfigKey] = stringify(config);
    const configSecret = encodeSecret(secretApp.name, secretData);
    if (secretApp.secrets) {
        secretApp.secrets.push(configSecret);
    } else {
        secretApp.secrets = [configSecret];
    }

    const secretVolume = {
        name: secretApp.name,
        secret: {
            defaultMode: 256,
            secretName: secretApp.name,
        },
    };
    if (secretApp.deploymentSpec.spec.template.spec.volumes) {
        secretApp.deploymentSpec.spec.template.spec.volumes.push(secretVolume);
    } else {
        secretApp.deploymentSpec.spec.template.spec.volumes = [secretVolume];
    }
    const volumeMount = {
        mountPath: "/opt/atm",
        name: secretVolume.name,
        readOnly: true,
    };
    if (secretApp.deploymentSpec.spec.template.spec.containers[0].volumeMounts) {
        secretApp.deploymentSpec.spec.template.spec.containers[0].volumeMounts.push(volumeMount);
    } else {
        secretApp.deploymentSpec.spec.template.spec.containers[0].volumeMounts = [volumeMount];
    }
    const secretEnv = {
        name: "ATOMIST_CONFIG_PATH",
        value: `${volumeMount.mountPath}/${sdmSecretConfigKey}`,
    };
    if (secretApp.deploymentSpec.spec.template.spec.containers[0].env) {
        secretApp.deploymentSpec.spec.template.spec.containers[0].env.push(secretEnv);
    } else {
        secretApp.deploymentSpec.spec.template.spec.containers[0].env = [secretEnv];
    }

    return secretApp;
}
