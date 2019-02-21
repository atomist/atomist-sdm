import {
    AutofixRegistration,
    hasFile,
} from "@atomist/sdm";

const PackageLock = "package-lock.json";

/**
 * Autofix to replace http registry links with https ones.
 *
 * Apparently the issue is fixed in npm but we are still seeing http link every once in a while:
 * https://npm.community/t/some-packages-have-dist-tarball-as-http-and-not-https/285
 */
export const PackageLockFix: AutofixRegistration = {
    name: "NPM package lock",
    pushTest: hasFile(PackageLock),
    transform: async p => {
        const packageLock = await p.getFile(PackageLock);
        const packageLockContent = (await packageLock.getContent()).replace(/http:/g, "https:");
        await packageLock.setContent(packageLockContent);
        return p;
    },
};
