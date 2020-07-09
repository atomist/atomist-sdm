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
    pushTest,
    PushTest,
} from "@atomist/sdm";
import { logger } from "@atomist/sdm/lib/client";

export function isNamed(...names: string[]): PushTest {
    return pushTest(`Project name is one of these '${names.join(", ")}'`, async pci => {
        if (names.includes(pci.project.name)) {
            logger.info("True: Project %s (in repo %s) in my list of names, which is %s", pci.project.name, pci.id.repo, names);
            return true;
        } else {
            logger.info("False: Project %s (in repo %s) is not in my list of names, which is %s", pci.project.name, pci.id.repo, names);
            return false;
        }
    });
}

export function nameMatches(...regexps: RegExp[]): PushTest {
    const res = regexps.map(r => r.toString()).join(", ");
    return pushTest(`Project name matches one of these regular expressions '${res}'`, async pci => {
        if (regexps.some(r => r.test(pci.project.name))) {
            logger.info("True: Project %s (in repo %s) matches a regular expression, one of %s", pci.project.name, pci.id.repo, res);
            return true;
        } else {
            logger.info("False: Project %s (in repo %s) does not match any regular expression, none of %s", pci.project.name, pci.id.repo, res);
            return false;
        }
    });
}

export function isOrgNamed(...names: string[]): PushTest {
    return pushTest(`Org name is one of these '${names.join(", ")}'`, async pci => {
        if (names.includes(pci.push.repo.owner)) {
            logger.info("True: Org %s (in repo %s) in my list of names, which is %s", pci.push.repo.owner, pci.id.repo, names);
            return true;
        } else {
            logger.info("False: Org %s (in repo %s) is not in my list of names, which is %s", pci.push.repo.owner, pci.id.repo, names);
            return false;
        }
    });
}

export function isTeam(...teams: string[]): PushTest {
    return pushTest(`Atomist team is one of these '${teams.join(", ")}'`, async pci => {
        return teams.includes(pci.context.workspaceId);
    });
}
