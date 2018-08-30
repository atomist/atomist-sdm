FROM ubuntu:17.10

LABEL maintainer="Atomist <docker@atomist.com>"

RUN apt-get update && apt-get install -y \
        curl \
        build-essential \
    && rm -rf /var/lib/apt/lists/*

ENV DUMB_INIT_VERSION=1.2.1
RUN curl -s -L -O https://github.com/Yelp/dumb-init/releases/download/v$DUMB_INIT_VERSION/dumb-init_${DUMB_INIT_VERSION}_amd64.deb \
    && dpkg -i dumb-init_${DUMB_INIT_VERSION}_amd64.deb \
    && rm -f dumb-init_${DUMB_INIT_VERSION}_amd64.deb

RUN mkdir -p /opt/app
WORKDIR /opt/app

ENV BLUEBIRD_WARNINGS 0
ENV NODE_ENV production
ENV NPM_CONFIG_LOGLEVEL warn
ENV SUPPRESS_NO_CONFIG_WARNING true

EXPOSE 2866

CMD [ "node_modules/.bin/atm-start" ]
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
    && npm install -g npm@6.4.1 \
    && npm install -g @atomist/cli@1.0.0-M.2 --unsafe-perm=true --allow-root \
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
