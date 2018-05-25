import { Configuration, logger, FailurePromise, SuccessPromise, Success } from "@atomist/automation-client";
import { GitProject } from "@atomist/automation-client/project/git/GitProject";
import * as clj from "@atomist/clj-editors";
import {
    branchFromCommit,
    DefaultDockerImageNameCreator,
    DockerBuildGoal,
    DockerOptions,
    executeDockerBuild,
    ExecuteGoalResult,
    executeVersioner,
    IsLein,
    ProjectVersioner,
    RunWithLogContext,
    SoftwareDeliveryMachine,
    VersionGoal,
    editorAutofixRegistration,
    ExecuteGoalWithLog,
    ProjectLoader,
    WithLoadedProject,
    Builder,
    SpawnBuilder
} from "@atomist/sdm";
import * as build from "@atomist/sdm/blueprint/dsl/buildDsl";
import { IsNode } from "@atomist/sdm/common/listener/support/pushtest/node/nodePushTests";
import { spawnAndWatch, asSpawnCommand } from "@atomist/sdm/util/misc/spawned";
import * as df from "dateformat";
import * as path from "path";
import { GitHubRepoRef } from "@atomist/automation-client/operations/common/GitHubRepoRef";

function withFileExistenceCheck(projectLoader: ProjectLoader, projectPredicate: (p: GitProject) => boolean , build: ExecuteGoalWithLog): ExecuteGoalWithLog {
    return async (rwlc: RunWithLogContext): Promise<ExecuteGoalResult> => {
        const { status, credentials, id, context, progressLog } = rwlc;
        const action: WithLoadedProject = async (p) => {
            return projectPredicate(p);
        };
        const check = await projectLoader.doWithProject({ credentials, id, context, readOnly: false }, action);
        logger.info(`checkForDockerfile ${check}`)
        if (check) {
            return build(rwlc);
        } else {
            return {code: 0, message: "Skipping project with no docker/Dockerfile"};
        }
    }
}

function checkForDockerfile(p: GitProject): boolean {
    const containsDocker = p.findFileSync("docker/DockerFile") != undefined;
    logger.info(`checkForDockerfile ${containsDocker}`);
    return containsDocker;
}

function leinBuilder(projectLoader: ProjectLoader): Builder {
   return new SpawnBuilder(
       {projectLoader, 
        options: {
            name: "atomist.sh",
            commands: [asSpawnCommand("./atomist.sh",{})],
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
            projectToAppInfo: async (p: GitProject) => {
                const projectClj = await p.findFile("project.clj");
                const path = await projectClj.path;
                logger.info(`run projectToAppInfo in ${p.baseDir}/${path}`);
                const basedir = p.baseDir;
                return {name: clj.getName(`${basedir}/${path}`),
                        version: clj.getVersion(`${basedir}/${path}`),
                        id: new GitHubRepoRef("owner", "repo")};},
            options: {
                env: {
                    ...process.env,
                },
            },
        }});
}

export function addLeinSupport(sdm: SoftwareDeliveryMachine,
                               configuration: Configuration) {

    sdm.addBuildRules(
        build.when(IsLein)
            .itMeans("Lein build")
            .set(leinBuilder(sdm.opts.projectLoader)),
    );

    sdm.addGoalImplementation("leinVersioner", VersionGoal,
            executeVersioner(sdm.opts.projectLoader, LeinProjectVersioner), { pushTest: IsLein })
        .addGoalImplementation("leinDockerBuild", DockerBuildGoal,
            withFileExistenceCheck(
                sdm.opts.projectLoader,
                checkForDockerfile,
                executeDockerBuild(
                    sdm.opts.projectLoader,
                    DefaultDockerImageNameCreator,
                    [MetajarPreparation],
                    {
                        ...configuration.sdm.docker.jfrog as DockerOptions,
                        dockerfileFinder: async () => "docker/Dockerfile",
                    })), { pushTest: IsLein })
        .addAutofixes(
            editorAutofixRegistration(
              {"name": "cljformat",
               "editor": async p => {
                    await clj.cljfmt(p.baseDir);
                    return p;
                },
              }));
    
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

export const LeinProjectVersioner: ProjectVersioner = async (status, p, log) => {
    const file = path.join(p.baseDir,"project.clj")
    const projectVersion = clj.getVersion(file);
    const branch = branchFromCommit(status.commit);
    const branchSuffix = branch !== status.commit.repo.defaultBranch ? `${branch}.` : "";
    const version = `${projectVersion}-${branchSuffix}${df(new Date(), "yyyymmddHHMMss")}`;

    await clj.setVersion(file,version);

    return version;
};
