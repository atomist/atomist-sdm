FROM gcr.io/kaniko-project/executor:v0.7.0

FROM ubuntu:18.04

LABEL maintainer="Atomist <docker@atomist.com>"

RUN apt-get update && apt-get install -y \
        dumb-init \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /opt/app

WORKDIR /opt/app

EXPOSE 2866

ENV BLUEBIRD_WARNINGS 0
ENV NODE_ENV production
ENV NPM_CONFIG_LOGLEVEL warn
ENV SUPPRESS_NO_CONFIG_WARNING true

ENTRYPOINT ["dumb-init", "node", "--trace-warnings", "--expose_gc", "--optimize_for_size", "--always_compact", "--max_old_space_size=384"]

CMD ["/opt/app/node_modules/.bin/atm-start"]

RUN apt-get update && apt-get install -y \
        build-essential \
        curl \
        git \
    && rm -rf /var/lib/apt/lists/*

RUN git config --global user.email "bot@atomist.com" \
    && git config --global user.name "Atomist Bot"

RUN curl -sL https://deb.nodesource.com/setup_11.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

RUN apt-get update && apt-get install -y \
        docker.io \
        openjdk-8-jdk-headless \
        unzip \
    && rm -rf /var/lib/apt/lists/*

ENV LEIN_ROOT true
RUN curl -sL -o /usr/local/bin/lein https://raw.githubusercontent.com/technomancy/leiningen/stable/bin/lein \
    && chmod +x /usr/local/bin/lein

COPY package.json package-lock.json ./

RUN npm ci \
    && npm cache clean --force

COPY . .

ENV NODE_OPTIONS --no-deprecation
