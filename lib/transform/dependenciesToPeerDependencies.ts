import { CodeTransform } from "@atomist/sdm";
import * as _ from "lodash";
import * as semver from "semver";

/**
 * Rewrite direct package dependencies to peerDependencies to allow easier consumption via
 * npm dependencies.
 * @param toRewrite
 */
export function dependenciesToPeerDependenciesTransform(...toRewrite: RegExp[]): CodeTransform {
    return async p => {
        const pjFile = await p.getFile("package.json");
        const pj = JSON.parse(await pjFile.getContent());

        toRewrite.forEach(r => r.global === true);

        _.forEach(pj.dependencies || {}, (version, name) => {
            if (toRewrite.some(r => r.test(name))) {
                const semVersion = `>=${semver.major(version)}.${semver.minor(version)}.0`;
                pj.peerDependencies[name] = semVersion;
                delete pj.dependencies[name];
            }
        });

        await pjFile.setContent(JSON.stringify(pj, undefined, 2));

        return p;
    };
}
