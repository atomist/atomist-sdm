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

import { logger } from "@atomist/automation-client";
import {
    ProductionEnvironment,
    RepoContext,
    SdmGoalEvent,
    SoftwareDeliveryMachine,
    StagingEnvironment,
} from "@atomist/sdm";
import { KubernetesApplicationOptions } from "@atomist/sdm-pack-k8";
import { IsMaven } from "@atomist/sdm-pack-spring";

export function kubernetesDeploymentData(sdm: SoftwareDeliveryMachine): (g: SdmGoalEvent, c: RepoContext) => Promise<KubernetesApplicationOptions> {
    return async (goal: SdmGoalEvent, context: RepoContext): Promise<KubernetesApplicationOptions> => {
        return sdm.configuration.sdm.projectLoader.doWithProject({
            credentials: context.credentials,
            id: context.id,
            readOnly: true,
        }, async p => {
            const ns = namespaceFromGoal(goal);
            const ingress = ingressFromGoal(goal.repo.name, ns);
            const port = (await IsMaven.predicate(p)) ? 8080 : 2866;
            return {
                name: goal.repo.name,
                environment: sdm.configuration.environment.split("_")[0],
                port,
                ns,
                imagePullSecret: "atomistjfrog",
                replicas: ns === "production" ? 3 : 1,
                ...ingress,
            };
        });
    };
}

function namespaceFromGoal(goal: SdmGoalEvent): string {
    const name = goal.repo.name;
    if (name === "atomist-internal-sdm") {
        if (goal.environment === StagingEnvironment.replace(/\/$/, "")) {
            return "sdm-testing";
        } else if (goal.environment === ProductionEnvironment.replace(/\/$/, "")) {
            return "sdm";
        }
    } else if (/-sdm$/.test(name) && name !== "sample-sdm" && name !== "spring-sdm") {
        return "sdm";
    } else if (name === "k8-automation") {
        return "k8-automation";
    } else if (goal.environment === StagingEnvironment.replace(/\/$/, "")) {
        return "testing";
    } else if (goal.environment === ProductionEnvironment.replace(/\/$/, "")) {
        return "production";
    }
    logger.debug(`Unmatched goal.environment using default namespace: ${goal.environment}`);
    return "default";
}

export interface Ingress {
    host: string;
    path: string;
    tlsSecret?: string;
}

export function ingressFromGoal(repo: string, ns: string): Ingress {
    let host: string;
    let path: string;
    const tail = (ns === "production") ? "com" : "services";
    if (repo === "card-automation") {
        host = "pusher";
        path = "/";
    } else if (repo === "sdm-automation") {
        return {
            host: `badge.atomist.${tail}`,
            path: "/",
        };
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
