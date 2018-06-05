import {
    logger,
} from "@atomist/automation-client";
import { GitHubRepoRef } from "@atomist/automation-client/operations/common/GitHubRepoRef";
import { GitProject } from "@atomist/automation-client/project/git/GitProject";
import * as clj from "@atomist/clj-editors";
import {
    allSatisfied,
    Builder,
    editorAutofixRegistration,
    ExecuteGoalResult,
    ExtensionPack,
    hasFile,
    ProjectLoader,
    RunWithLogContext,
} from "@atomist/sdm";
import * as build from "@atomist/sdm/dsl/buildDsl";
import {
    DockerBuildGoal,
    VersionGoal,
} from "@atomist/sdm/goal/common/commonGoals";
import { branchFromCommit } from "@atomist/sdm/internal/delivery/build/executeBuild";
import {
    executeVersioner,
    ProjectVersioner,
} from "@atomist/sdm/internal/delivery/build/local/projectVersioner";
import { SpawnBuilder } from "@atomist/sdm/internal/delivery/build/local/SpawnBuilder";
import { IsLein } from "@atomist/sdm/mapping/pushtest/jvm/jvmPushTests";
import {
    DefaultDockerImageNameCreator,
    DockerOptions,
    executeDockerBuild,
} from "@atomist/sdm/pack/docker/executeDockerBuild";
import {
    asSpawnCommand,
    spawnAndWatch,
} from "@atomist/sdm/util/misc/spawned";
import { SpawnOptions } from "child_process";
import * as df from "dateformat";
import * as _ from "lodash/";
import * as path from "path";

export const LeinSupport: ExtensionPack = {
    name: "Leiningen Support",
    vendor: "Atomist",
    version: "0.1.0",
    configure: sdm => {

        sdm.addBuildRules(
            build.when(IsLein)
                .itMeans("Lein build")
                .set(leinBuilder(sdm.configuration.sdm.projectLoader)),
        );

        sdm.addGoalImplementation("leinVersioner", VersionGoal,
            executeVersioner(sdm.configuration.sdm.projectLoader, LeinProjectVersioner), { pushTest: IsLein })
            .addGoalImplementation("leinDockerBuild", DockerBuildGoal,
                executeDockerBuild(
                    sdm.configuration.sdm.projectLoader,
                    DefaultDockerImageNameCreator,
                    [MetajarPreparation],
                    {
                        ...sdm.configuration.sdm.docker.jfrog as DockerOptions,
                        dockerfileFinder: async () => "docker/Dockerfile",
                    }), { pushTest: allSatisfied(IsLein, hasFile("docker/Dockerfile")) })
            .addAutofixes(
                editorAutofixRegistration(
                    {
                        name: "cljformat",
                        editor: async p => {
                            await clj.cljfmt(p.baseDir);
                            return p;
                        },
                        pushTest: IsLein,
                    }));

    },
};

const key = "(12 15 6 4 13 3 9 10 0 8 8 14 7 16 0 3)";

function leinBuilder(projectLoader: ProjectLoader): Builder {
    return new SpawnBuilder(
        {
            projectLoader,
            options: {
                name: "atomist.sh",
                commands: [asSpawnCommand("./atomist.sh", {env: {}})],
                errorFinder: (code, signal, l) => {
                    return code !== 0;
                },
                logInterpreter: log => {
                    return {
                        // We don't yet know how to interpret clojure logs
                        relevantPart: undefined,
                        message: "lein errors",
                    };
                },
                enrich: async (options: SpawnOptions, p: GitProject): Promise<SpawnOptions> => {
                    const encryptedEnv = {env: {ARTIFACTORY_USER: clj.vault(key, `${p.baseDir}/vault.txt`)["artifactory-user"],
                                                ARTIFACTORY_PWD: clj.vault(key, `${p.baseDir}/vault.txt`)["artifactory-pwd"]}};
                    const enriched = _.merge(options, encryptedEnv) as SpawnOptions;
                    return enriched;
                },
                projectToAppInfo: async (p: GitProject) => {
                    const projectClj = await p.findFile("project.clj");
                    logger.info(`run projectToAppInfo in ${p.baseDir}/${projectClj.path}`);
                    return {
                        name: clj.getName(`${p.baseDir}/${projectClj.path}`),
                        version: clj.getVersion(`${p.baseDir}/${projectClj.path}`),
                        id: new GitHubRepoRef( "owner", "repo"),
                    };
                },
                options: {
                    env: {
                        ...process.env,
                    },
                },
            },
        });
}

export async function MetajarPreparation(p: GitProject, rwlc: RunWithLogContext): Promise<ExecuteGoalResult> {
    const result = await spawnAndWatch({
        command: "lein",
        args: ["with-profile", "metajar", "do", "clean,", "metajar"],
    },
        {
            cwd: p.baseDir,
        },
        rwlc.progressLog,
        {
            errorFinder: code => code !== 0,
        });
    return result;
}

export const LeinProjectVersioner: ProjectVersioner = async (status, p) => {
    const file = path.join(p.baseDir, "project.clj");
    const projectVersion = clj.getVersion(file);
    const branch = branchFromCommit(status.commit);
    const branchSuffix = branch !== status.commit.repo.defaultBranch ? `${branch}.` : "";
    const version = `${projectVersion}-${branchSuffix}${df(new Date(), "yyyymmddHHMMss")}`;

    await clj.setVersion(file, version);

    return version;
};
