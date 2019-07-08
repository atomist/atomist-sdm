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
    LeveledLogMethod,
    logger,
} from "@atomist/automation-client";
import {
    CacheConfiguration,
    GoalInvocation,
    ProgressLog,
} from "@atomist/sdm";
import { GoalCacheArchiveStore } from "@atomist/sdm-core";
import { Storage } from "@google-cloud/storage";

export interface GoogleCloudStorageCacheConfiguration extends CacheConfiguration {
    cache?: {
        /**
         * Google Cloud Storage bucket to perist cache entries to.  If
         * not provided, it defaults to
         * "sdm-WORKSPACE_ID-SDM_NAME-goal-cache", with "WORKSPACE_ID"
         * replaced with your Atomist workspace ID and "SDM_NAME"
         * replaced with the name of the running SDM, converting
         * letters to lower case and removing all characters that are
         * not letter, numbers, and dashes (-).  It makes no attempt
         * to create this bucket, so make sure it exists before trying
         * to use it.
         */
        bucket?: string;
        /** Set to true to enable goal input/output caching */
        enabled?: boolean;
        /** Path prefix, defaults to "goal-cache". */
        path?: string;
    };
}

type GcsOp = (s: Storage, b: string, p: string) => Promise<any>;

/**
 * Goal archive store that stores the compressed archives in a Google
 * Cloud Storage bucket.  All failures are caught and logged.  If
 * retrieval fails, the error is rethrown so the cache-miss listeners
 * will be invoked.
 */
export class GoogleCloudStorageGoalCacheArchiveStore implements GoalCacheArchiveStore {

    public async store(gi: GoalInvocation, classifier: string, archivePath: string): Promise<void> {
        await this.gcs(gi, classifier, async (storage, bucket, cachePath) => storage.bucket(bucket).upload(archivePath, {
            destination: cachePath,
            predefinedAcl: "projectPrivate",
        }), "store");
    }

    public async delete(gi: GoalInvocation, classifier: string): Promise<void> {
        await this.gcs(gi, classifier, async (storage, bucket, cachePath) => storage.bucket(bucket).file(cachePath).delete(), "delete");
    }

    public async retrieve(gi: GoalInvocation, classifier: string, targetArchivePath: string): Promise<void> {
        await this.gcs(gi, classifier, async (storage, bucket, cachePath) => storage.bucket(bucket).file(cachePath).download({
            destination: targetArchivePath,
        }), "retrieve");
    }

    private async gcs(gi: GoalInvocation, classifier: string, op: GcsOp, verb: string): Promise<void> {
        const cacheConfig = getCacheConfig(gi);
        const cachePath = getCachePath(gi, classifier);
        const storage = new Storage();
        const objectUri = `gs://${cacheConfig.bucket}/${cachePath}`;
        const gerund = verb.replace(/e$/, "ing");
        try {
            ll(`${gerund} cache archive ${objectUri}`, gi.progressLog);
            await op(storage, cacheConfig.bucket, cachePath);
            ll(`${verb}d cache archive ${objectUri}`, gi.progressLog);
        } catch (e) {
            e.message = `Failed to ${verb} cache archive ${objectUri}: ${e.message}`;
            ll(e.message, gi.progressLog, logger.error);
            if (verb === "retrieve") {
                throw e;
            }
        }
    }

}

/** Construct unique object path for goal invocation. */
export function getCachePath(gi: GoalInvocation, classifier: string = "default"): string {
    const cacheConfig = getCacheConfig(gi);
    const cachePath = [
        cacheConfig.path,
        gi.context.workspaceId,
        gi.goalEvent.repo.providerId,
        gi.goalEvent.repo.owner,
        gi.goalEvent.repo.name,
        gi.goalEvent.branch,
        classifier,
        `${gi.goalEvent.sha}-cache.tar.gz`,
    ].join("/");
    return cachePath;
}

/**
 * Retrieve cache configuration and populate with default values.
 */
export function getCacheConfig(gi: GoalInvocation): GoogleCloudStorageCacheConfiguration["cache"] {
    const cacheConfig = gi.configuration.sdm.cache || {};
    cacheConfig.bucket = cacheConfig.bucket ||
        `sdm-${gi.context.workspaceId}-${gi.configuration.name}-goal-cache`.toLowerCase().replace(/[^-a-z0-9]*/g, "")
            .replace(/--+/g, "-");
    cacheConfig.path = cacheConfig.path || "goal-cache";
    return cacheConfig;
}

/** Write to goal progress log and client log. */
function ll(msg: string, pl: ProgressLog, l: LeveledLogMethod = logger.debug): void {
    l(msg);
    pl.write(msg);
}
