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

// GOAL Definition

import {
    AutofixGoal,
    BuildGoal,
    Goal,
    Goals,
    GoalWithPrecondition,
    IndependentOfEnvironment,
    ProductionEnvironment,
    ReviewGoal,
    StagingEnvironment,
} from "@atomist/sdm";
import {
    DockerBuildGoal,
    TagGoal,
    VersionGoal,
} from "@atomist/sdm/goal/common/commonGoals";

export const PublishGoal = new GoalWithPrecondition({
    uniqueName: "Publish",
    environment: IndependentOfEnvironment,
    orderedName: "2-publish",
    displayName: "publish",
    workingDescription: "Publishing...",
    completedDescription: "Published",
    failedDescription: "Published failed",
    isolated: true,
}, BuildGoal);

export const PublishBranchGoal = new GoalWithPrecondition({
    uniqueName: "PublishBranch",
    environment: IndependentOfEnvironment,
    orderedName: "2-publish-branch",
    displayName: "publish",
    workingDescription: "Publishing...",
    completedDescription: "Published",
    failedDescription: "Published failed",
    isolated: true,
}, BuildGoal);

export const StagingDeploymentGoal = new GoalWithPrecondition({
    uniqueName: "DeployToTest",
    environment: StagingEnvironment,
    orderedName: "3-deploy",
    displayName: "deploy to Test",
    completedDescription: "Deployed to Test",
    failedDescription: "Test deployment failure",
    waitingForApprovalDescription: "Promote to Prod",
    approvalRequired: true,
}, DockerBuildGoal);

export const ProductionDeploymentGoal = new Goal({
    uniqueName: "DeployToProduction",
    environment: ProductionEnvironment,
    orderedName: "3-prod-deploy",
    displayName: "deploy to Prod",
    completedDescription: "Deployed to Prod",
    failedDescription: "Prod deployment failure",
});

export const ReleaseNpmGoal = new Goal({
    uniqueName: "ReleaseNpm",
    environment: ProductionEnvironment,
    orderedName: "3-release-npm",
    displayName: "release NPM package",
    workingDescription: "Releasing NPM package...",
    completedDescription: "Released NPM package",
    failedDescription: "Release NPM package failure",
    isolated: true,
});

export const ReleaseDockerGoal = new Goal({
    uniqueName: "ReleaseDocker",
    environment: ProductionEnvironment,
    orderedName: "3-release-docker",
    displayName: "release Docker image",
    workingDescription: "Releasing Docker image...",
    completedDescription: "Released Docker image",
    failedDescription: "Release Docker image failure",
    isolated: true,
});

export const ReleaseTagGoal = new Goal({
    uniqueName: "ReleaseTag",
    environment: ProductionEnvironment,
    orderedName: "3-release-tag",
    displayName: "create release tag",
    completedDescription: "Created release tag",
    failedDescription: "Creating release tag failure",
});

export const ReleaseDocsGoal = new Goal({
    uniqueName: "ReleaseDocs",
    environment: ProductionEnvironment,
    orderedName: "3-release-docs",
    displayName: "publish docs",
    workingDescription: "Publishing docs...",
    completedDescription: "Published docs",
    failedDescription: "Publishing docs failure",
    isolated: true,
});

export const ReleaseVersionGoal = new GoalWithPrecondition({
    uniqueName: "ReleaseVersion",
    environment: ProductionEnvironment,
    orderedName: "3-release-version",
    displayName: "increment version",
    completedDescription: "Incremented version",
    failedDescription: "Incrementing version failure",
}, ReleaseDocsGoal);

// GOALSET Definition

// Just running review and autofix
export const CheckGoals = new Goals(
    "Check",
    VersionGoal,
    ReviewGoal,
    AutofixGoal,
);

// Just running the build and publish
export const BuildGoals = new Goals(
    "Build",
    ...CheckGoals.goals,
    BuildGoal,
    PublishBranchGoal,
    TagGoal,
);

// Just running the build and publish
export const BuildReleaseGoals = new Goals(
    "Build with Release",
    ...CheckGoals.goals,
    BuildGoal,
    new GoalWithPrecondition({ ...PublishGoal.definition, approvalRequired: true }, ...PublishGoal.dependsOn),
    TagGoal,
    new GoalWithPrecondition(ReleaseNpmGoal.definition, PublishGoal),
    new GoalWithPrecondition(ReleaseTagGoal.definition, ReleaseNpmGoal),
    new GoalWithPrecondition(ReleaseDocsGoal.definition, PublishGoal),
    ReleaseVersionGoal,
);

// Build including docker build
export const DockerGoals = new Goals(
    "Docker Build",
    ...BuildGoals.goals,
    DockerBuildGoal,
);

// Build including docker build
export const DockerReleaseGoals = new Goals(
    "Docker Build with Release",
    ...CheckGoals.goals,
    BuildGoal,
    new GoalWithPrecondition({ ...PublishGoal.definition, approvalRequired: true }, ...PublishGoal.dependsOn),
    new GoalWithPrecondition(TagGoal.definition, BuildGoal),
    new GoalWithPrecondition(ReleaseNpmGoal.definition, PublishGoal),
    new GoalWithPrecondition({ ...DockerBuildGoal.definition, approvalRequired: true }, ...DockerBuildGoal.dependsOn),
    new GoalWithPrecondition(ReleaseDockerGoal.definition, DockerBuildGoal),
    new GoalWithPrecondition(ReleaseTagGoal.definition, ReleaseNpmGoal, ReleaseDockerGoal),
    new GoalWithPrecondition(ReleaseDocsGoal.definition, DockerBuildGoal),
    ReleaseVersionGoal,
);

// Docker build and testing and production kubernetes deploy
export const KubernetesDeployGoals = new Goals(
    "Deploy",
    ...CheckGoals.goals,
    BuildGoal,
    PublishGoal,
    DockerBuildGoal,
    TagGoal,
    StagingDeploymentGoal,
    new GoalWithPrecondition(ProductionDeploymentGoal.definition, StagingDeploymentGoal),
    new GoalWithPrecondition(ReleaseNpmGoal.definition, StagingDeploymentGoal),
    new GoalWithPrecondition(ReleaseDockerGoal.definition, StagingDeploymentGoal),
    new GoalWithPrecondition(ReleaseTagGoal.definition, ReleaseNpmGoal, ReleaseDockerGoal),
    new GoalWithPrecondition(ReleaseDocsGoal.definition, StagingDeploymentGoal),
    ReleaseVersionGoal,
);

// Docker build and testing and production kubernetes deploy
export const SimplifiedKubernetesDeployGoals = new Goals(
    "Simplified Deploy",
    ...CheckGoals.goals,
    BuildGoal,
    PublishGoal,
    DockerBuildGoal,
    TagGoal,
    new GoalWithPrecondition({ ...ProductionDeploymentGoal.definition, approvalRequired: true }, DockerBuildGoal),
    new GoalWithPrecondition(ReleaseNpmGoal.definition, ProductionDeploymentGoal),
    new GoalWithPrecondition(ReleaseDockerGoal.definition, ProductionDeploymentGoal),
    new GoalWithPrecondition(ReleaseTagGoal.definition, ReleaseNpmGoal, ReleaseDockerGoal),
    new GoalWithPrecondition(ReleaseDocsGoal.definition, ProductionDeploymentGoal),
    ReleaseVersionGoal,
);

// Only deploy to staging
export const StagingKubernetesDeployGoals = new Goals(
    "Staging Deploy",
    ...CheckGoals.goals,
    BuildGoal,
    PublishGoal,
    DockerBuildGoal,
    TagGoal,
    new GoalWithPrecondition({ ...StagingDeploymentGoal.definition, approvalRequired: false }, ...StagingDeploymentGoal.dependsOn),
);

export const LibraryPublished = new Goal({
    uniqueName: "LibraryPublished",
    environment: ProductionEnvironment,
    orderedName: "3-prod-library-published",
    displayName: "publish library",
    completedDescription: "Library Published",
});

export const LeinBuildGoals = new Goals(
    "Lein Docker Build",
    ...CheckGoals.goals,
    BuildGoal,
    TagGoal,
    // new GoalWithPrecondition(LibraryPublished.definition, TagGoal),
);

export const LeinDockerGoals = new Goals(
    "Lein Docker Build",
    ...LeinBuildGoals.goals,
    DockerBuildGoal,
);
