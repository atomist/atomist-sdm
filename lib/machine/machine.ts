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

import {
	goals,
	IsDeployEnabled,
	not,
	SoftwareDeliveryMachine,
	SoftwareDeliveryMachineConfiguration,
	ToDefaultBranch,
	whenPushSatisfies,
} from "@atomist/sdm";
import { newGitHubTokenSupport } from "@atomist/sdm-pack-github-token";
import {
	createSoftwareDeliveryMachine,
	DisableDeploy,
	EnableDeploy,
	IsInLocalMode,
} from "@atomist/sdm/lib/core";
import { HasDockerfile } from "@atomist/sdm/lib/pack/docker";
import { githubGoalStatusSupport } from "@atomist/sdm/lib/pack/github-goal-status";
import { goalStateSupport } from "@atomist/sdm/lib/pack/goal-state";
import { IsMaven, MaterialChangeToJavaRepo } from "@atomist/sdm/lib/pack/jvm";
import { k8sGoalSchedulingSupport } from "@atomist/sdm/lib/pack/k8s";
import { IsNode } from "@atomist/sdm/lib/pack/node";
import { notificationSupport } from "@atomist/sdm/lib/pack/notification";
import { ApprovalCommand, CancelApprovalCommand } from "../command/approval";
import { isNamed, isOrgNamed, nameMatches } from "../support/identityPushTests";
import { MaterialChangeToNodeRepo } from "../support/materialChangeToNodeRepo";
import { addDockerSupport } from "./dockerSupport";
import { addGithubSupport } from "./githubSupport";
import {
	BuildGoals,
	BuildReleaseGoals,
	DockerGoals,
	DockerReleaseAndHomebrewGoals,
	DockerReleaseGoals,
	FixGoals,
	KubernetesDeployGoals,
	LocalGoals,
	MavenBuildGoals,
	MavenDockerReleaseGoals,
	OrgVisualizerKubernetesDeployGoals,
	orgVisualizerProductionDeploy,
	orgVisualizerStagingDeploy,
	productionDeploy,
	productionDeployWithApproval,
	SimplifiedKubernetesDeployGoals,
	stagingDeploy,
} from "./goals";
import { addHomebrewSupport } from "./homebrewSupport";
import {
	kubernetesDeployRegistrationProd,
	kubernetesDeployRegistrationStaging,
	orgVisualizerKubernetesDeployRegistrationProd,
	orgVisualizerKubernetesDeployRegistrationStaging,
} from "./k8sSupport";
import { addMavenSupport } from "./mavenSupport";
import { addNodeSupport } from "./nodeSupport";
import { IsReleaseCommit } from "./release";
import { addFileVersionerSupport } from "./version";

export function machine(
	configuration: SoftwareDeliveryMachineConfiguration,
): SoftwareDeliveryMachine {
	stagingDeploy.with(kubernetesDeployRegistrationStaging);
	orgVisualizerStagingDeploy.with(
		orgVisualizerKubernetesDeployRegistrationStaging,
	);
	productionDeploy.with(kubernetesDeployRegistrationProd);
	orgVisualizerProductionDeploy.with(
		orgVisualizerKubernetesDeployRegistrationProd,
	);
	productionDeployWithApproval.with(kubernetesDeployRegistrationProd);

	const NoGoals = goals("No Goals");

	const sdm = createSoftwareDeliveryMachine(
		{
			name: "Atomist Software Delivery Machine",
			configuration,
		},

		whenPushSatisfies(isOrgNamed("atomist-skills")).setGoals(NoGoals),
		whenPushSatisfies(isOrgNamed("atomist-blogs")).setGoals(NoGoals),
		whenPushSatisfies(isOrgNamed("atomist-seeds"), not(nameMatches(/sdm/)))
			.itMeans("Non-Atomist seed")
			.setGoals(NoGoals),

		whenPushSatisfies(
			isOrgNamed("sdd-manifesto"),
			isNamed("manifesto", "manifesto-app"),
		)
			.itMeans("Manifesto repository")
			.setGoals(NoGoals),

		whenPushSatisfies(IsReleaseCommit)
			.itMeans("Release commit")
			.setGoals(NoGoals),

		whenPushSatisfies(IsNode, IsInLocalMode)
			.itMeans("Node repository in local mode")
			.setGoals(LocalGoals),

		// Node
		whenPushSatisfies(IsNode, not(IsMaven), not(MaterialChangeToNodeRepo))
			.itMeans("No Material Change")
			.setGoals(FixGoals),

		// Maven
		whenPushSatisfies(IsMaven, not(MaterialChangeToJavaRepo))
			.itMeans("No Material Change")
			.setGoals(FixGoals),

		whenPushSatisfies(
			IsMaven,
			MaterialChangeToJavaRepo,
			not(ToDefaultBranch),
		)
			.itMeans("Build Java")
			.setGoals(MavenBuildGoals),

		whenPushSatisfies(
			IsMaven,
			MaterialChangeToJavaRepo,
			HasDockerfile,
			ToDefaultBranch,
		)
			.itMeans("Maven Docker Release Build")
			.setGoals(MavenDockerReleaseGoals),

		// Simplified deployment goal set for some SDMs; we are skipping
		// testing for these and deploying straight into their respective namespaces
		whenPushSatisfies(
			IsNode,
			HasDockerfile,
			ToDefaultBranch,
			isNamed(
				"atomist-sdm",
				"atomist-web-sdm",
				"manifesto-sdm",
				"catalog-sdm",
			),
		)
			.itMeans("Simplified Deploy")
			.setGoals(SimplifiedKubernetesDeployGoals),

		// Deploy org-visualizer
		whenPushSatisfies(
			IsNode,
			HasDockerfile,
			ToDefaultBranch,
			isNamed("aspect-sdm"),
		)
			.itMeans("Deploy")
			.setGoals(OrgVisualizerKubernetesDeployGoals),

		// Deploy k8s-sdm to all the clusters
		whenPushSatisfies(
			IsNode,
			HasDockerfile,
			ToDefaultBranch,
			isNamed("k8s-sdm"),
		)
			.itMeans("Multi Cluster Deploy")
			.setGoals(KubernetesDeployGoals),

		whenPushSatisfies(isNamed("cli"), IsNode, ToDefaultBranch)
			.itMeans("CLI Release Build")
			.setGoals(DockerReleaseAndHomebrewGoals),

		whenPushSatisfies(
			IsNode,
			HasDockerfile,
			ToDefaultBranch,
			IsDeployEnabled,
		)
			.itMeans("Deploy")
			.setGoals(KubernetesDeployGoals),

		whenPushSatisfies(IsNode, HasDockerfile, ToDefaultBranch)
			.itMeans("Docker Release Build")
			.setGoals(DockerReleaseGoals),

		whenPushSatisfies(IsNode, HasDockerfile)
			.itMeans("Docker Build")
			.setGoals(DockerGoals),

		whenPushSatisfies(IsNode, not(HasDockerfile), ToDefaultBranch)
			.itMeans("Release Build")
			.setGoals(BuildReleaseGoals),

		whenPushSatisfies(IsNode, not(HasDockerfile))
			.itMeans("Build")
			.setGoals(BuildGoals),
	);

	sdm.addCommand(EnableDeploy).addCommand(DisableDeploy);

	addGithubSupport(sdm);
	addDockerSupport(sdm);
	addMavenSupport(sdm);
	addNodeSupport(sdm);
	addHomebrewSupport(sdm);
	addFileVersionerSupport(sdm);

	sdm.addExtensionPacks(
		k8sGoalSchedulingSupport(),
		goalStateSupport({
			cancellation: {
				enabled: true,
			},
		}),
		githubGoalStatusSupport(),
		notificationSupport(),
		newGitHubTokenSupport(),
	);

	sdm.addCommand(ApprovalCommand).addCommand(CancelApprovalCommand);

	return sdm;
}
