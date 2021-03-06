# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [Unreleased](https://github.com/atomist/atomist-sdm/compare/1.4.0...HEAD)

### Added

-   Add GCS goal cache support. [#201](https://github.com/atomist/atomist-sdm/issues/201)
-   Add tsx files as a material change. [#215](https://github.com/atomist/atomist-sdm/issues/215)
-   Use prettier to format GraphQL. [5d12d7f](https://github.com/atomist/atomist-sdm/commit/5d12d7f90885463930ded8286ee6b5f83f2aa190)

### Changed

-   Update TypeScript deps and move to dev. [11eb3ee](https://github.com/atomist/atomist-sdm/commit/11eb3ee991602a39293ddd8530d460af46cabc6c)
-   Do not add community files to atomist-sdm. [8014035](https://github.com/atomist/atomist-sdm/commit/8014035e580449509f03b44d4223bffc3212abb2)
-   Make email a link in SECURITY.md. [9da81f2](https://github.com/atomist/atomist-sdm/commit/9da81f2aca6db9110d9ab60a5dedb4eed1577765)
-   Update sdm, remove other Atomist dependencies. [da68baf](https://github.com/atomist/atomist-sdm/commit/da68baf56db93708c33b7f3b567b241417c52b53)
-   Disable builds in atomist-blogs. [6c2f1ae](https://github.com/atomist/atomist-sdm/commit/6c2f1ae5e77caad5b1a77a05525ae7ac9e249beb)
-   Update to @atomist/sdm@2.1.2. [c6ffca7](https://github.com/atomist/atomist-sdm/commit/c6ffca7fc5d8b79521e1af0e141076edd6ebb500)

### Removed

-   Move code snippet autofix work to docs-sdm. [#197](https://github.com/atomist/atomist-sdm/issues/197)
-   Remove automation-client push test from SDMs. [929d37a](https://github.com/atomist/atomist-sdm/commit/929d37a130b31ee69a709c1e39adefc5b3658525)
-   Remove unused autofixes and transforms. [610cdd3](https://github.com/atomist/atomist-sdm/commit/610cdd32a0057005556f56ea3369eaa807571b37)
-   Remove old commands. [a1e8edc](https://github.com/atomist/atomist-sdm/commit/a1e8edc0939fa42d966808299a618d9d2f4bd158)
-   Remove team policies. [db204d3](https://github.com/atomist/atomist-sdm/commit/db204d3cb7c756b4a6bf371638af334f285ca6f3)
-   Remove build pack. [8ab3926](https://github.com/atomist/atomist-sdm/commit/8ab3926820b9776dc1a4af22fb12fe8634f5f7b1)
-   Remove unused dependnecies and sdm-local. [91c0df0](https://github.com/atomist/atomist-sdm/commit/91c0df09b28246de3f3283ac17e4cb3843d819e3)
-   Remove sdm-pack-changelog. [3283a56](https://github.com/atomist/atomist-sdm/commit/3283a56042d23f784bb24735b72f1fae42f72b65)
-   Remove client extensions. [64a6338](https://github.com/atomist/atomist-sdm/commit/64a6338f36f16caf213887220ba0e101423e0a37)
-   Remove sdm-pack-issue. [a1cf416](https://github.com/atomist/atomist-sdm/commit/a1cf416c201a5b0ae4ca4dfa14c4e6d56ec0be8e)
-   Remove approval voting. [#226](https://github.com/atomist/atomist-sdm/issues/226)

### Fixed

-   Retain bottle section of homebrew formula. [#202](https://github.com/atomist/atomist-sdm/issues/202)
-   Security fixes. [4f1666d](https://github.com/atomist/atomist-sdm/commit/4f1666d826e95a07134778d5388e51f00c82de75)

## [1.4.0](https://github.com/atomist/atomist-sdm/compare/1.2.0...1.4.0) - 2019-06-15

### Added

-   Add Go support. [#122](https://github.com/atomist/atomist-sdm/issues/122)
-   Automatically update homebrew-core CLI formula. [#180](https://github.com/atomist/atomist-sdm/issues/180)

## [1.2.0](https://github.com/atomist/atomist-sdm/compare/1.1.1...1.2.0) - 2019-04-05

### Added

-   Add autofix and code inspection to web site goals. [cbb16fa](https://github.com/atomist/atomist-sdm/commit/cbb16facfff9244c16a1f5194be4ad1dc11fb6d3)
-   Add autofix to web app goals. [cbb16fa](https://github.com/atomist/atomist-sdm/commit/cbb16facfff9244c16a1f5194be4ad1dc11fb6d3) [b2e576f](https://github.com/atomist/atomist-sdm/commit/b2e576f11b0620835c892fae7fd8f5b8b1b81028)

### Changed

-   Clean up goals for web repos and others. [#116](https://github.com/atomist/atomist-sdm/issues/116)
-   Use PublishToS3 sync option. [0ad71f2](https://github.com/atomist/atomist-sdm/commit/0ad71f2821d8f40eafd416951fe64d159a8b93b0)

### Fixed

-   Fix for s3 deploy goals. [fc5fe57](https://github.com/atomist/atomist-sdm/commit/fc5fe572fe9aab5225496bcbec5138b6fe76d9f6)
-   Correct release version logic. [d993baf](https://github.com/atomist/atomist-sdm/commit/d993baff9943b0da9c1ec8a922188890771a3dfd)

## [1.1.1](https://github.com/atomist/atomist-sdm/compare/1.1.0...1.1.1) - 2019-04-03

### Fixed

-   Add zlib1g-dev to Docker image. [2ea6ab2](https://github.com/atomist/atomist-sdm/commit/2ea6ab23950145d7b6978fbaae328b953171d85d)
-   Always run `npm ci` with dev. [7becf74](https://github.com/atomist/atomist-sdm/commit/7becf74d3f36050ab23c2e5e8e26baa0c37e969e)

## [1.1.0](https://github.com/atomist/atomist-sdm/compare/1.0.2...1.1.0) - 2019-04-03

### Added

-   Java build support. [#102](https://github.com/atomist/atomist-sdm/issues/102)
-   Add nginx.ingress annotations to ingressSpec. [#107](https://github.com/atomist/atomist-sdm/issues/107)
-   Add simple Docker build. [#109](https://github.com/atomist/atomist-sdm/issues/109)
-   Add support for building static web sites. [#115](https://github.com/atomist/atomist-sdm/issues/115)

### Changed

-   Update to use sdm-pack-k8s. [#99](https://github.com/atomist/atomist-sdm/issues/99)
-   Only build our seeds. [#104](https://github.com/atomist/atomist-sdm/issues/104)
-   Update docker build and k8s deployment. [#112](https://github.com/atomist/atomist-sdm/issues/112)

## [1.0.2](https://github.com/atomist/atomist-sdm/compare/0.3.4...1.0.2) - 2019-02-06

### Changed

-   Move TSLint from build step to code inspection. [#82](https://github.com/atomist/atomist-sdm/issues/82)
-   Fail transfrom when npm install fails. [280d6b8](https://github.com/atomist/atomist-sdm/commit/280d6b893ac2c3c5d09454c0155971d8e1dec53e)
-   Sync up kube specs and Dockerfile. [#85](https://github.com/atomist/atomist-sdm/issues/85)
-   Upsert license headers. [#93](https://github.com/atomist/atomist-sdm/issues/93)

### Removed

-   Remove autostart package script. [#84](https://github.com/atomist/atomist-sdm/issues/84)

## [0.3.4](https://github.com/atomist/atomist-sdm/compare/0.3.3...0.3.4) - 2018-11-07

## [0.3.3](https://github.com/atomist/atomist-sdm/compare/0.3.2...0.3.3) - 2018-11-07

## [0.3.2](https://github.com/atomist/atomist-sdm/compare/0.3.1...0.3.2) - 2018-11-06

## [0.3.1](https://github.com/atomist/atomist-sdm/compare/0.3.0...0.3.1) - 2018-11-05

## [0.3.0](https://github.com/atomist/atomist-sdm/compare/0.2.0...0.3.0) - 2018-11-05

### Added

-   Add fingerprint support for npm. [#52](https://github.com/atomist/atomist-sdm/issues/52)
-   Keep collaborator documents up to date. [#68](https://github.com/atomist/atomist-sdm/issues/68)
-   Update Homebrew formula for CLI when it is released. [#69](https://github.com/atomist/atomist-sdm/issues/69)
-   Provide autofix for tslint.json. [#77](https://github.com/atomist/atomist-sdm/issues/77)

### Changed

-   Update src to lib in dependencies. [#54](https://github.com/atomist/atomist-sdm/issues/54)
-   Move to projectListeners for nom install, version and compile. [#65](https://github.com/atomist/atomist-sdm/issues/65)
-   Update Dockerfile to latest standard. [#72](https://github.com/atomist/atomist-sdm/issues/72)
-   Make update support files a code transform command. [#80](https://github.com/atomist/atomist-sdm/issues/80)
-   Run autofix on immaterial changes to Node repos. [#79](https://github.com/atomist/atomist-sdm/issues/79)

### Fixed

-   Do not add license headers to .d.ts files. [#43](https://github.com/atomist/atomist-sdm/issues/43)

## [0.2.0](https://github.com/atomist/atomist-sdm/compare/0.1.5...0.2.0) - 2018-09-11

### Added

-   Add update dependencies transform. [#bcde17b](https://github.com/atomist/atomist-sdm/commit/bcde17b9e09a0f27f14884892599004adc3ffce4)
-   Add support for SDM local mode. [#41](https://github.com/atomist/atomist-sdm/issues/41)
-   Add code transforms for Atomist peer dependencies and package.json author. [#42](https://github.com/atomist/atomist-sdm/issues/42)

### Fixed

-   Do not put a header before a shebang line. [#37](https://github.com/atomist/atomist-sdm/issues/37)

## [0.1.5](https://github.com/atomist/atomist-sdm/compare/0.1.4...0.1.5) - 2018-08-22

### Added

-   Support for releasing M and RC releases from a tag. [#30](https://github.com/atomist/atomist-sdm/issues/30)

## [0.1.4](https://github.com/atomist/atomist-sdm/compare/0.1.3...0.1.4) - 2018-07-19

### Added

-   Add team policy checks for issue and PR titles and commit messages. [#25](https://github.com/atomist/atomist-sdm/issues/25)
-   Making sure the developer tutorials get built. [#26](https://github.com/atomist/atomist-sdm/issues/26)
-   Delete NPM dist-tags when the branch gets deleted. [#27](https://github.com/atomist/atomist-sdm/issues/27)

### Changed

-   Support building non-client TypeScript projects.

### Fixed

-   Respect `#!` lines when adding license header.
-   Double approval required for non-automation-client Node.js builds. [#23](https://github.com/atomist/atomist-sdm/issues/23)

## [0.1.3](https://github.com/atomist/atomist-sdm/compare/0.1.1...0.1.3) - 2018-07-05

### Added

-   Mark changelog entry breaking if breaking label is used. [#18](https://github.com/atomist/atomist-sdm/issues/18)
-   Publish TypeDoc when Node project is released.
-   Increment version after release.
-   Common build tools to Docker image.
-   Add release to change log.
-   Configure ingress for card-automation. [#21](https://github.com/atomist/atomist-sdm/issues/21)

### Changed

-   Lein support disabled.
-   Breakout changelog support into extension pack. [#22](https://github.com/atomist/atomist-sdm/issues/22)

## [0.1.1](https://github.com/atomist/atomist-sdm/compare/0.1.0...0.1.1) - 2018-05-10

### Changed

-   Version.

## [0.1.0](https://github.com/atomist/atomist-sdm/tree/0.1.0) - 2018-05-10

### Added

-   Build, deploy, and release automation-client/SDM projects.
-   Build and deploy lein projects.
-   Build TypeScript projects.
