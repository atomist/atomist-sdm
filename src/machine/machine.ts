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
    DoNotSetAnyGoals,
    IsDeployEnabled,
    not,
    SoftwareDeliveryMachine,
    SoftwareDeliveryMachineConfiguration,
    ToDefaultBranch,
    whenPushSatisfies,
} from "@atomist/sdm";
import {
    NoGoals,
    TagGoal,
} from "@atomist/sdm/goal/common/commonGoals";
import {
    disableDeploy,
    enableDeploy,
} from "@atomist/sdm/handlers/commands/SetDeployEnablement";
import { executeTag } from "@atomist/sdm/internal/delivery/build/executeTag";
import { summarizeGoalsInGitHubStatus } from "@atomist/sdm/internal/delivery/goals/support/githubStatusSummarySupport";
import { createSoftwareDeliveryMachine } from "@atomist/sdm/machine/machineFactory";
import { HasTravisFile } from "@atomist/sdm/mapping/pushtest/ci/ciPushTests";
import { HasDockerfile } from "@atomist/sdm/mapping/pushtest/docker/dockerPushTests";
import {
    IsAtomistAutomationClient,
    IsNode,
} from "@atomist/sdm/mapping/pushtest/node/nodePushTests";
import {
    IsSimplifiedDeployment,
    IsTeam,
} from "../support/isSimplifiedDeployment";
import { MaterialChangeToClojureRepo } from "../support/materialChangeToClojureRepo";
import { MaterialChangeToNodeRepo } from "../support/materialChangeToNodeRepo";
import {
    BuildGoals,
    BuildReleaseGoals,
    CheckGoals,
    DockerGoals,
    DockerReleaseGoals,
    KubernetesDeployGoals,
    LeinBuildGoals,
    LeinDockerGoals,
    SimplifiedKubernetesDeployGoals,
    StagingKubernetesDeployGoals,
} from "./goals";
import { addLeinSupport, IsLein } from "./leinSupport";
import { addNodeSupport } from "./nodeSupport";

export function machine(configuration: SoftwareDeliveryMachineConfiguration): SoftwareDeliveryMachine {
    const sdm = createSoftwareDeliveryMachine({
        name: "Atomist Software Delivery Machine",
        configuration,
    },

        whenPushSatisfies(IsLein)
            .itMeans("Temporarily disable Lein features of SDM")
            .setGoals(DoNotSetAnyGoals),

        whenPushSatisfies(not(IsLein), IsTeam("T095SFFBK"))
            .itMeans("Non Clojure repository in Atomist team")
            .setGoals(DoNotSetAnyGoals),

        whenPushSatisfies(not(IsNode), IsTeam("T29E48P34"))
            .itMeans("Non Node repository in Community team")
            .setGoals(DoNotSetAnyGoals),

        // Node

        whenPushSatisfies(IsNode, not(MaterialChangeToNodeRepo))
            .itMeans("No Material Change")
            .setGoals(NoGoals),

        whenPushSatisfies(IsNode, HasTravisFile)
            .itMeans("Just Checking")
            .setGoals(CheckGoals),

        // Simplified deployment goalset for automation-client-sdm and k8-automation; we are skipping
        // testing for these and deploying straight into their respective namespaces
        whenPushSatisfies(IsNode, HasDockerfile, ToDefaultBranch, IsAtomistAutomationClient,
            IsSimplifiedDeployment("k8-automation", "atomist-sdm", "clojure-sdm"))
            .itMeans("Simplified Deploy")
            .setGoals(SimplifiedKubernetesDeployGoals),

        whenPushSatisfies(IsNode, HasDockerfile, ToDefaultBranch, IsAtomistAutomationClient,
            IsSimplifiedDeployment("sample-sdm"))
            .itMeans("Staging Deploy")
            .setGoals(StagingKubernetesDeployGoals),

        whenPushSatisfies(IsNode, HasDockerfile, ToDefaultBranch, IsDeployEnabled, IsAtomistAutomationClient)
            .itMeans("Deploy")
            .setGoals(KubernetesDeployGoals),

        whenPushSatisfies(IsNode, HasDockerfile, ToDefaultBranch, IsDeployEnabled, IsAtomistAutomationClient)
            .itMeans("Deploy")
            .setGoals(KubernetesDeployGoals),

        whenPushSatisfies(IsNode, HasDockerfile, ToDefaultBranch, IsAtomistAutomationClient)
            .itMeans("Docker Release Build")
            .setGoals(DockerReleaseGoals),

        whenPushSatisfies(IsNode, HasDockerfile, IsAtomistAutomationClient)
            .itMeans("Docker Build")
            .setGoals(DockerGoals),

        whenPushSatisfies(IsNode, not(HasDockerfile), ToDefaultBranch)
            .itMeans("Release Build")
            .setGoals(BuildReleaseGoals),

        whenPushSatisfies(IsNode, not(HasDockerfile))
            .itMeans("Build")
            .setGoals(BuildGoals),

        // Clojure

        whenPushSatisfies(IsLein, not(HasTravisFile), not(MaterialChangeToClojureRepo))
            .itMeans("No material change")
            .setGoals(NoGoals),

        whenPushSatisfies(IsLein, not(HasTravisFile), HasDockerfile, ToDefaultBranch, MaterialChangeToClojureRepo)
            .itMeans("Build a Clojure Service with Leiningen")
            .setGoals(LeinDockerGoals),

        whenPushSatisfies(IsLein, not(HasTravisFile), not(HasDockerfile), ToDefaultBranch, MaterialChangeToClojureRepo)
            .itMeans("Build a Clojure Library with Leiningen")
            .setGoals(LeinBuildGoals),

    );

    sdm.addSupportingCommands(enableDeploy, disableDeploy);

    sdm.addGoalImplementation("tag", TagGoal,
        executeTag(sdm.configuration.sdm.projectLoader));

    addNodeSupport(sdm);
    addLeinSupport(sdm);

    summarizeGoalsInGitHubStatus(sdm);

    return sdm;
}
