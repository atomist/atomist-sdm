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
    goal,
    goals,
    GoalWithFulfillment,
    IndependentOfEnvironment,
    ProductionEnvironment,
    PushImpact,
    Queue,
} from "@atomist/sdm";
import { Tag, Version } from "@atomist/sdm-core";
import { Changelog } from "@atomist/sdm-pack-changelog/lib/goal/Changelog";
import { DockerBuild } from "@atomist/sdm-pack-docker";
import { KubernetesDeploy } from "@atomist/sdm-pack-k8s";

export const queue = new Queue({ concurrent: 5 });

export const autoCodeInspection = new AutoCodeInspection({ isolate: true });
export const pushImpact = new PushImpact();
export const version = new Version();
export const autofix = new Autofix({ setAuthor: true });
export const build = new GoalWithFulfillment({
    uniqueName: "build",
    environment: IndependentOfEnvironment,
    displayName: "build",
    workingDescription: "Building",
    completedDescription: "Built",
    failedDescription: "Build failed",
    isolated: true,
});
export const tag = new Tag();
export const tagWithApproval = new Tag({ approval: true });
export const dockerBuild = new DockerBuild({ retryCondition: { retries: 5 } });

export const stagingDeploy = new KubernetesDeploy({ environment: "testing", approval: true });
export const orgVisualizerStagingDeploy = new KubernetesDeploy({ environment: "testing" });
export const productionDeploy = new KubernetesDeploy({ environment: "production" });
export const orgVisualizerProductionDeploy = new KubernetesDeploy({ environment: "production" });
export const productionDeployWithApproval = new KubernetesDeploy({ environment: "production", approval: true });
export const demoProductionDeploy = new KubernetesDeploy({ environment: "production" });
export const integrationProductionDeploy = new KubernetesDeploy({ environment: "production" });

export const deploymentGate = goal(
    {
        displayName: "deployment",
        preApproval: true,
        environment: "testing",
        descriptions: {
            planned: "Deployment pending",
            waitingForPreApproval: "Deployment pending",
            completed: "Deployment started",
        },
    },
    async gi => {
        /** Intentionally left empty */
    },
);

export const releaseChangelog = new Changelog();

export const publish = new GoalWithFulfillment(
    {
        uniqueName: "publish",
        environment: IndependentOfEnvironment,
        displayName: "publish",
        workingDescription: "Publishing",
        completedDescription: "Published",
        failedDescription: "Publish failed",
        isolated: true,
    },
    build,
    dockerBuild,
);

export const publishWithApproval = new GoalWithFulfillment(
    {
        uniqueName: "publish-approval",
        environment: IndependentOfEnvironment,
        displayName: "publish",
        workingDescription: "Publishing",
        completedDescription: "Published",
        failedDescription: "Publish failed",
        isolated: true,
        approvalRequired: true,
    },
    build,
    dockerBuild,
);

export const release = new GoalWithFulfillment({
    uniqueName: "release",
    environment: ProductionEnvironment,
    displayName: "release",
    workingDescription: "Releasing",
    completedDescription: "Released",
    failedDescription: "Release failed",
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

export const releaseVersion = new GoalWithFulfillment(
    {
        uniqueName: "release-version",
        environment: ProductionEnvironment,
        displayName: "increment version",
        workingDescription: "Incrementing version",
        completedDescription: "Incremented version",
        failedDescription: "Incrementing version failure",
    },
    releaseChangelog,
);

// GOALSET Definition

// Just autofix
export const FixGoals = goals("Fix").plan(queue).plan(autofix).after(queue);

// Just running review and autofix
export const CheckGoals = goals("Check").plan(queue).plan(autofix, autoCodeInspection, pushImpact).after(queue);

// Goals for running in local mode
export const LocalGoals = goals("Local Build")
    .plan(queue)
    .plan(autofix, pushImpact)
    .after(queue)
    .plan(version)
    .after(autofix)
    .plan(build)
    .after(autofix, version)
    .plan(autoCodeInspection)
    .after(build);

// Just running the build and publish
export const BuildGoals = goals("Build").plan(LocalGoals).plan(tag, publish).after(build);

// Just running the build and publish
export const BuildReleaseGoals = goals("Build with Release")
    .plan(LocalGoals)
    .plan(tag)
    .after(build)
    .plan(publishWithApproval)
    .after(build)
    .plan(release, releaseDocs, releaseVersion)
    .after(publishWithApproval, autoCodeInspection)
    .plan(releaseChangelog)
    .after(releaseVersion)
    .plan(releaseTag)
    .after(release);

// Build including docker build
export const DockerGoals = goals("Docker Build").plan(BuildGoals).plan(dockerBuild).after(build);

export const MavenBuildGoals = goals("Build").plan(LocalGoals).plan(tag).after(build);

// Build including docker build
export const MavenDockerReleaseGoals = goals("Docker Build with Release")
    .plan(LocalGoals)
    .plan(dockerBuild)
    .after(build)
    .plan(tag)
    .after(dockerBuild)
    .plan(stagingDeploy)
    .after(dockerBuild)
    .plan(productionDeploy)
    .after(stagingDeploy, autoCodeInspection)
    .plan(releaseDocker)
    .after(productionDeploy)
    .plan(releaseTag)
    .after(releaseDocker);

// Build including docker build
export const DockerReleaseGoals = goals("Docker Build with Release")
    .plan(LocalGoals)
    .plan(dockerBuild)
    .after(build)
    .plan(tag)
    .after(dockerBuild)
    .plan(publishWithApproval)
    .after(build, dockerBuild)
    .plan(release, releaseDocker, releaseDocs, releaseVersion)
    .after(publishWithApproval, autoCodeInspection)
    .plan(releaseChangelog)
    .after(releaseVersion)
    .plan(releaseTag)
    .after(release, releaseDocker);

export const DockerReleaseAndHomebrewGoals = goals("Docker and Homebrew with Release")
    .plan(DockerReleaseGoals)
    .plan(releaseHomebrew)
    .after(release);

export const SimpleDockerReleaseGoals = goals("Simple Docker Build with Release")
    .plan(version)
    .plan(dockerBuild)
    .after(version)
    .plan(tagWithApproval)
    .after(dockerBuild)
    .plan(releaseDocker, releaseVersion)
    .after(tagWithApproval)
    .plan(releaseChangelog)
    .after(releaseVersion)
    .plan(releaseTag)
    .after(releaseDocker);

// Docker build and testing and production kubernetes deploy
export const KubernetesDeployGoals = goals("Deploy")
    .plan(DockerGoals)
    .plan(stagingDeploy)
    .after(dockerBuild)
    .plan(productionDeploy)
    .after(stagingDeploy, autoCodeInspection)
    .plan(release, releaseDocker, releaseDocs, releaseVersion)
    .after(productionDeploy)
    .plan(releaseChangelog)
    .after(releaseVersion)
    .plan(releaseTag)
    .after(release, releaseDocker);

export const OrgVisualizerKubernetesDeployGoals = goals("Job Deploy")
    .plan(DockerGoals)
    .plan(stagingDeploy, orgVisualizerStagingDeploy)
    .after(dockerBuild)
    .plan(productionDeploy, orgVisualizerProductionDeploy)
    .after(stagingDeploy, autoCodeInspection)
    .plan(release, releaseDocker, releaseDocs, releaseVersion)
    .after(productionDeploy)
    .plan(releaseChangelog)
    .after(releaseVersion)
    .plan(releaseTag)
    .after(release, releaseDocker);

// Docker build and testing and production kubernetes deploy
export const SimplifiedKubernetesDeployGoals = goals("Simplified Deploy")
    .plan(DockerGoals)
    .plan(productionDeployWithApproval)
    .after(dockerBuild, autoCodeInspection)
    .plan(release, releaseDocker, releaseDocs, releaseVersion)
    .after(productionDeployWithApproval)
    .plan(releaseChangelog)
    .after(releaseVersion)
    .plan(releaseTag)
    .after(release, releaseDocker);

// Docker build and testing and demo kubernetes deploy, no release
export const DemoKubernetesDeployGoals = goals("Demo Deploy")
    .plan(DockerGoals)
    .plan(demoProductionDeploy)
    .after(dockerBuild, autoCodeInspection);

// Docker build and testing and multiple production kubernetes deploys
export const MultiKubernetesDeployGoals = goals("Multiple Deploy")
    .plan(DockerGoals)
    .plan(stagingDeploy)
    .after(dockerBuild)
    .plan(demoProductionDeploy, integrationProductionDeploy, productionDeploy)
    .after(stagingDeploy, autoCodeInspection)
    .plan(release, releaseDocker, releaseDocs, releaseVersion)
    .after(stagingDeploy)
    .plan(releaseChangelog)
    .after(releaseVersion)
    .plan(releaseTag)
    .after(release, releaseDocker);

export const noOpGoalExecutor = () => Promise.resolve({ code: 0, message: "Nothing to do" });
