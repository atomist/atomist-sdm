FROM atomist/sdm-base:0.4.1

RUN apt-get update && apt-get install -y \
        openjdk-8-jdk-headless maven \
        bundler \
        zlib1g-dev \
        gradle \
        docker.io \
    && rm -rf /var/lib/apt/lists/*

RUN curl -sfL https://dl.google.com/go/go1.14.4.linux-amd64.tar.gz | tar -C /usr/local -xzf -

RUN curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/master/install.sh | bash -s -- -b $(go env GOPATH)/bin v1.27.0

ENV LEIN_ROOT true
RUN curl -sfL -o /usr/local/bin/lein https://raw.githubusercontent.com/technomancy/leiningen/stable/bin/lein \
    && chmod +x /usr/local/bin/lein

RUN curl -sfL https://htmltest.wjdp.uk | sudo bash -s -- -b /usr/local/bin

RUN npm i -g npm-check-updates

COPY package.json package-lock.json ./

RUN npm ci \
    && npm cache clean --force

COPY . ./
