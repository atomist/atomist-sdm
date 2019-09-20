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
    Project,
    projectUtils,
} from "@atomist/automation-client";
import { CodeTransform } from "@atomist/sdm";
import * as path from "path";

/**
 * CodeTransform to prepare a project to package TS files in the final NPM archive.
 */
export const SourcesTransform: CodeTransform = async p => {

    const files = (await projectUtils.gatherFromFiles(p, ["**/*.ts"], async f => f))
        .filter(f => !f.path.endsWith(".d.ts"));

    if (files.length > 0) {
        // Make sure the src path exists and we can move files into
        await p.addDirectory("src");

        for (const file of files) {
            // Get both map files
            const basePath = file.path;
            const base = file.path.slice(0, -3);
            const tsMap = `${base}.d.ts.map`;
            const jsMap = `${base}.js.map`;

            // Move the ts file out of the way
            await p.moveFile(file.path, path.join("src", file.path));

            await updateSourceMap(tsMap, p, basePath);
            await updateSourceMap(jsMap, p, basePath);
        }
    }
};

async function updateSourceMap(mapPath: string, p: Project, basePath: string): Promise<void> {
    const segments = `..${path.sep}`.repeat(basePath.split("/").length - 1);
    if (await p.hasFile(mapPath)) {
        const mapFile = await p.getFile(mapPath);
        const sourceMap = JSON.parse(await mapFile.getContent());
        sourceMap.sources = [
            `${segments}src${path.sep}${basePath}`,
        ];
        await mapFile.setContent(JSON.stringify(sourceMap));
    }
}
