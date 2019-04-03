FROM atomist/sdm-base:0.2.0

RUN apt-get update && apt-get install -y \
        openjdk-8-jdk-headless maven \
        bundler \
        zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

ENV LEIN_ROOT true
RUN curl -sL -o /usr/local/bin/lein https://raw.githubusercontent.com/technomancy/leiningen/stable/bin/lein \
    && chmod +x /usr/local/bin/lein

RUN curl https://htmltest.wjdp.uk | sudo bash -s -- -b /usr/local/bin

COPY package.json package-lock.json ./

RUN npm ci \
    && npm cache clean --force

COPY . ./
