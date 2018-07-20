/*
 * Copyright © 2018 Atomist, Inc.
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

import { InMemoryFile } from "@atomist/automation-client/project/mem/InMemoryFile";
import { InMemoryProject } from "@atomist/automation-client/project/mem/InMemoryProject";
import assert = require("power-assert");
import { NpmDockerfileFix } from "../../../src/autofix/npm/dockerfileFix";

const Dockerfile = `FROM ubuntu:17.10

LABEL maintainer="Atomist <docker@atomist.com>"

RUN apt-get update && apt-get install -y \
        curl \
        build-essential \
&& rm -rf /var/lib/apt/lists/*

ENV DUMB_INIT_VERSION=1.2.1
RUN curl -s -L -O https://github.com/Yelp/dumb-init/releases/download/v$DUMB_INIT_VERSION/dumb-init_\${DUMB_INIT_VERSION}_amd64.deb \
    && dpkg -i dumb-init_\${DUMB_INIT_VERSION}_amd64.deb \
    && rm -f dumb-init_\${DUMB_INIT_VERSION}_amd64.deb

RUN mkdir -p /opt/app
WORKDIR /opt/app

ENV BLUEBIRD_WARNINGS 0
ENV NODE_ENV production
ENV NPM_CONFIG_LOGLEVEL warn
ENV SUPPRESS_NO_CONFIG_WARNING true

EXPOSE 2866

CMD [ "node_modules/@atomist/automation-client/start.client.js" ]
ENTRYPOINT [ "dumb-init", "node", "--trace-warnings", "--expose_gc", "--optimize_for_size", "--always_compact", "--max_old_space_size=384" ]

RUN apt-get update && apt-get install -y \
        docker.io \
        git \
        unzip \
    && rm -rf /var/lib/apt/lists/*

RUN git config --global user.email "bot@atomist.com" \
    &&  git config --global user.name "Atomist Bot"

RUN curl -sL https://deb.nodesource.com/setup_9.x | bash - \
    && apt-get update \
    && apt-get install -y nodejs \
    && npm i -g npm@6.1.0 \
    && rm -rf /var/lib/apt/lists/*

RUN curl -sL -o /usr/local/bin/kubectl https://storage.googleapis.com/kubernetes-release/release/v1.8.12/bin/linux/amd64/kubectl \
    && chmod +x /usr/local/bin/kubectl \
    && kubectl version --client

# Log everything to figure out that is going on with npm ci
RUN npm config set loglevel silly

# Install app dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Bundle app source
COPY . .
`;

describe("dockerfileFix", () => {

    it("should update npm version", async () => {
        const p = InMemoryProject.of(new InMemoryFile("Dockerfile", Dockerfile));
        const rp = await (NpmDockerfileFix as any).transform(p);
        const df = await rp.getFile("Dockerfile");

        assert(await df.getContent() !== Dockerfile);

    }).timeout(1000 * 5);

});
