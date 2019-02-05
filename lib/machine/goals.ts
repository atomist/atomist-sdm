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

// GOAL Definition

import {
    AutoCodeInspection,
    Autofix,
    Fingerprint,
    goals,
    GoalWithFulfillment,
    IndependentOfEnvironment,
    ProductionEnvironment,
    PushImpact,
} from "@atomist/sdm";
import {
    Tag,
    Version,
} from "@atomist/sdm-core";
import { Build } from "@atomist/sdm-pack-build";
import { Changelog } from "@atomist/sdm-pack-changelog/lib/goal/Changelog";
import { DockerBuild } from "@atomist/sdm-pack-docker";
import { KubernetesDeploy } from "@atomist/sdm-pack-k8s";

export const autoCodeInspection = new AutoCodeInspection();
export const pushImpact = new PushImpact();
export const version = new Version();
export const autofix = new Autofix();
export const build = new Build();
export const tag = new Tag();
export const dockerBuild = new DockerBuild();
export const fingerprint = new Fingerprint();

export const stagingDeploy = new KubernetesDeploy({ environment: "testing", approval: true });
export const productionDeploy = new KubernetesDeploy({ environment: "production" });
export const productionDeployWithApproval = new KubernetesDeploy({ environment: "production", approval: true });
export const globalStagingDeploy = new KubernetesDeploy({ environment: "testing", approval: true });
export const globalProductionDeploy = new KubernetesDeploy({ environment: "production" });
export const demoProductionDeploy = new KubernetesDeploy({ environment: "production" });

export const releaseChangelog = new Changelog();

export const publish = new GoalWithFulfillment({
    uniqueName: "publish",
    environment: IndependentOfEnvironment,
    displayName: "publish",
    workingDescription: "Publishing",
    completedDescription: "Published",
    failedDescription: "Publish failed",
    isolated: true,
}, build, dockerBuild);

export const publishWithApproval = new GoalWithFulfillment({
    uniqueName: "publish-approval",
    environment: IndependentOfEnvironment,
    displayName: "publish",
    workingDescription: "Publishing",
    completedDescription: "Published",
    failedDescription: "Publish failed",
    isolated: true,
    approvalRequired: true,
}, build, dockerBuild);

export const releaseNpm = new GoalWithFulfillment({
    uniqueName: "release-npm",
    environment: ProductionEnvironment,
    displayName: "release NPM package",
    workingDescription: "Releasing NPM package",
    completedDescription: "Released NPM package",
    failedDescription: "Release NPM package failure",
    isolated: true,
});

export const releaseDocker = new GoalWithFulfillment({
    uniqueName: "release-docker",
    environment: ProductionEnvironment,
    displayName: "release Docker image",
    workingDescription: "Releasing Docker image",
    completedDescription: "Released Docker image",
    failedDescription: "Release Docker image failure",
    isolated: true,
});

export const releaseTag = new GoalWithFulfillment({
    uniqueName: "release-tag",
    environment: ProductionEnvironment,
    displayName: "create release tag",
    workingDescription: "Creating release tag",
    completedDescription: "Created release tag",
    failedDescription: "Creating release tag failure",
});

export const releaseDocs = new GoalWithFulfillment({
    uniqueName: "release-docs",
    environment: ProductionEnvironment,
    displayName: "publish docs",
    workingDescription: "Publishing docs",
    completedDescription: "Published docs",
    failedDescription: "Publishing docs failure",
    isolated: true,
});

export const releaseHomebrew = new GoalWithFulfillment({
    uniqueName: "release-homebrew",
    environment: ProductionEnvironment,
    displayName: "release Homebrew formula",
    workingDescription: "Releasing Homebrew formula",
    completedDescription: "Released Homebrew formula",
    failedDescription: "Release Homebrew formula failure",
    isolated: true,
});

export const releaseVersion = new GoalWithFulfillment({
    uniqueName: "release-version",
    environment: ProductionEnvironment,
    displayName: "increment version",
    workingDescription: "Incrementing version",
    completedDescription: "Incremented version",
    failedDescription: "Incrementing version failure",
}, releaseChangelog);

// GOALSET Definition

// Just autofix
export const FixGoals = goals("Fix")
    .plan(autofix);

// Just running review and autofix
export const CheckGoals = goals("Check")
    .plan(autofix, autoCodeInspection, pushImpact, fingerprint);

// Goals for running in local mode
export const LocalGoals = goals("Local Build")
    .plan(autofix, pushImpact, fingerprint)
    .plan(version).after(autofix)
    .plan(build).after(autofix, version)
    .plan(autoCodeInspection).after(build);

// Just running the build and publish
export const BuildGoals = goals("Build")
    .plan(LocalGoals)
    .plan(tag, publish).after(build);

// Just running the build and publish
export const BuildReleaseGoals = goals("Build with Release")
    .plan(LocalGoals)
    .plan(tag).after(build)
    .plan(publishWithApproval).after(build)
    .plan(releaseNpm, releaseDocs, releaseVersion).after(publishWithApproval, autoCodeInspection)
    .plan(releaseChangelog).after(releaseVersion)
    .plan(releaseTag).after(releaseNpm);

export const BuildReleaseAndHomebrewGoals = goals("Build with Release, Homebrew")
    .plan(BuildReleaseGoals)
    .plan(releaseHomebrew).after(releaseNpm);

// Build including docker build
export const DockerGoals = goals("Docker Build")
    .plan(BuildGoals)
    .plan(dockerBuild).after(build);

// Build including docker build
export const DockerReleaseGoals = goals("Docker Build with Release")
    .plan(LocalGoals)
    .plan(dockerBuild).after(build)
    .plan(tag).after(dockerBuild)
    .plan(publishWithApproval).after(build, dockerBuild)
    .plan(releaseNpm, releaseDocker, releaseDocs, releaseVersion).after(publishWithApproval, autoCodeInspection)
    .plan(releaseChangelog).after(releaseVersion)
    .plan(releaseTag, releaseHomebrew).after(releaseNpm, releaseDocker);

// Docker build and testing and production kubernetes deploy
export const KubernetesDeployGoals = goals("Deploy")
    .plan(DockerGoals)
    .plan(stagingDeploy).after(dockerBuild)
    .plan(productionDeploy).after(stagingDeploy, autoCodeInspection)
    .plan(releaseNpm, releaseDocker, releaseDocs, releaseVersion).after(productionDeploy)
    .plan(releaseChangelog).after(releaseVersion)
    .plan(releaseTag).after(releaseNpm, releaseDocker);

// Docker build and testing and production kubernetes deploy
export const SimplifiedKubernetesDeployGoals = goals("Simplified Deploy")
    .plan(DockerGoals)
    .plan(productionDeployWithApproval).after(dockerBuild, autoCodeInspection)
    .plan(releaseNpm, releaseDocker, releaseDocs, releaseVersion).after(productionDeployWithApproval)
    .plan(releaseChangelog).after(releaseVersion)
    .plan(releaseTag).after(releaseNpm, releaseDocker);

// Docker build and testing and production kubernetes deploy to global cluster
export const GlobalKubernetesDeployGoals = goals("Deploy")
    .plan(DockerGoals)
    .plan(globalStagingDeploy).after(dockerBuild)
    .plan(globalProductionDeploy).after(globalStagingDeploy, autoCodeInspection)
    .plan(releaseNpm, releaseDocker, releaseDocs, releaseVersion).after(globalProductionDeploy)
    .plan(releaseChangelog).after(releaseVersion)
    .plan(releaseTag).after(releaseNpm, releaseDocker);

// Docker build and testing and multiple production kubernetes deploys
export const MultiKubernetesDeployGoals = goals("Multiple Deploy")
    .plan(DockerGoals)
    .plan(productionDeployWithApproval).after(dockerBuild, autoCodeInspection)
    .plan(demoProductionDeploy, globalProductionDeploy).after(productionDeployWithApproval)
    .plan(releaseNpm, releaseDocker, releaseDocs, releaseVersion).after(productionDeployWithApproval)
    .plan(releaseChangelog).after(releaseVersion)
    .plan(releaseTag).after(releaseNpm, releaseDocker);
