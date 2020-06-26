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

import { ExecuteGoal, ExecuteGoalResult, GoalInvocation, spawnLog } from "@atomist/sdm";

/** Simple executable interface */
export interface GoalProjectCommand {
    /** Executable */
    command: string;
    /** Arguments to executable */
    args?: string[];
}

/**
 * Execute provided commands in project.
 */
export function executeGoalCommandsInProject(cmds: GoalProjectCommand[]): ExecuteGoal {
    return async (gi: GoalInvocation): Promise<ExecuteGoalResult> => {
        const { configuration, credentials, id, context } = gi;

        return configuration.sdm.projectLoader.doWithProject({ credentials, id, context, readOnly: true }, async p => {
            const opts = {
                cwd: p.baseDir,
                log: gi.progressLog,
            };
            let res: ExecuteGoalResult;
            for (const cmd of cmds) {
                try {
                    res = await spawnLog(cmd.command, cmd.args, opts);
                } catch (e) {
                    res = {
                        code: -1,
                        message: `Failed to spawn command ${cmd.command} ${cmd.args.join(" ")}: ${e.message}`,
                    };
                }
                if (res.code !== 0) {
                    break;
                }
            }
            gi.progressLog.write(`Goal commands complete, returning ${JSON.stringify(res)}`);
            return res;
        });
    };
}
