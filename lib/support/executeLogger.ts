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
	DelimitedWriteProgressLogDecorator,
	ExecuteGoalResult,
	ProgressLog,
	spawnLog,
	SpawnLogCommand,
	SpawnLogOptions,
} from "@atomist/sdm";
import { GitCommandGitProject, logger, Success } from "@atomist/sdm/lib/client";

export async function loglog(log: ProgressLog, msg: string): Promise<void> {
	logger.debug(msg);
	log.write(`${msg}\n`);
	await log.flush();
}

export type ExecuteLogger = (l: ProgressLog) => Promise<ExecuteGoalResult>;

export interface SpawnWatchCommand {
	cmd: SpawnLogCommand;
	cwd?: string;
}

/**
 * Transform a SpawnWatchCommand into an ExecuteLogger suitable for
 * execution by executeLoggers.  The operation is awaited and any
 * thrown exceptions are caught and transformed into an error result.
 * If an error occurs, it is logged.  The result of the operation is
 * transformed into a ExecuteGoalResult.  If an exception is caught,
 * the returned code is guaranteed to be non-zero.
 */
export function spawnExecuteLogger(swc: SpawnWatchCommand): ExecuteLogger {
	return async (log: ProgressLog) => {
		const opts: SpawnLogOptions = {
			...swc.cmd.options,
			log,
		};
		if (swc.cwd) {
			opts.cwd = swc.cwd;
		}
		let res;
		try {
			res = await spawnLog(swc.cmd.command, swc.cmd.args, opts);
		} catch (e) {
			res = {
				code: -1,
				message: `Spawned command errored: ${
					swc.cmd.command
				} ${swc.cmd.args.join(" ")}: ${e.message}`,
			};
		}
		if (res.error) {
			if (!res.message) {
				res.message = `Spawned command failed (status:${res.code}): ${
					swc.cmd.command
				} ${swc.cmd.args.join(" ")}`;
			}
			logger.error(res.message);
			log.write(res.message);
		}
		return res;
	};
}

/**
 * Transform a GitCommandGitProject operation into an ExecuteLogger
 * suitable for execution by executeLoggers.  The operation is awaited
 * and any thrown exceptions are caught and transformed into an error
 * result.  The returned standard out and standard error are written
 * to the log.  If an error occurs, it is logged.  The result of the
 * operation is transformed into a ExecuteGoalResult.  If an error is
 * returned or exception caught, the returned code is guaranteed to be
 * non-zero.
 */
export function gitExecuteLogger(
	gp: GitCommandGitProject,
	op: () => Promise<GitCommandGitProject>,
	name: string,
): ExecuteLogger {
	return async (log: ProgressLog) => {
		log.write(`Running: git ${name}`);
		try {
			await op();
			log.write(`Success: git ${name}`);
			return { code: 0 };
		} catch (e) {
			log.write(e.stdout);
			log.write(e.stderr);
			const message = `Failure: git ${name}: ${e.message}`;
			log.write(message);
			return {
				code: e.code,
				message,
			};
		}
	};
}

/**
 * Execute an array of logged commands, creating a line-delimited
 * progress log beforehand, flushing after each command, and closing
 * it at the end.  If any command fails, bail out and return the
 * failure result.  Otherwise return Success.
 */
export async function executeLoggers(
	els: ExecuteLogger[],
	progressLog: ProgressLog,
): Promise<ExecuteGoalResult> {
	const log = new DelimitedWriteProgressLogDecorator(progressLog, "\n");
	for (const cmd of els) {
		const res = await cmd(log);
		await log.flush();
		if (res.code !== 0) {
			return res;
		}
	}
	return Success;
}
