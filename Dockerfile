FROM atomist/sdm-base:0.0.1

RUN apt-get update && apt-get install -y \
        openjdk-8-jdk-headless \
    && rm -rf /var/lib/apt/lists/*

ENV LEIN_ROOT true
RUN curl -sL -o /usr/local/bin/lein https://raw.githubusercontent.com/technomancy/leiningen/stable/bin/lein \
    && chmod +x /usr/local/bin/lein

# Using atomist-sdm as directory is required so that kaniko could use /opt
# for other content
RUN mkdir -p /atomist-sdm/app

WORKDIR /atomist-sdm/app

COPY package.json package-lock.json ./

RUN npm ci \
    && npm cache clean --force

COPY . .

# Declaring a volume will instruct kaniko to skip the directory when snapshotting
VOLUME /atomist-sdm

CMD ["/atomist-sdm/app/node_modules/.bin/atm-start"]
