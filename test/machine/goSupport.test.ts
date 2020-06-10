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

import { InMemoryProject } from "@atomist/automation-client";
import { ProgressLog } from "@atomist/sdm";
import * as assert from "power-assert";
import { goIncrementPatch } from "../../lib/machine/goSupport";

describe("machine/go", () => {

    describe("goIncrementPatch", () => {

        it("should increment the patch", async () => {
            const v = `// Copyright © 2018 Atomist
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
)

const (
	pkg     = "k8svent"
	version = "0.11.0"
)

// versionCmd represents the version command
var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Print version and exit",
	Long:  "Print the package name and version in the standard format.",
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println(pkg, version)
	},
}

func init() {
	RootCmd.AddCommand(versionCmd)
}
`;
            const m = `# Makefile for Travis CI

GO = go
GO_FLAGS = -v
GO_ARGS = $(shell go list ./...)
GO_BUILD_ARGS =

TARGET = k8svent
DOCKER_TARGET = docker/$(TARGET)
DOCKER_IMAGE = atomist/$(TARGET)
DOCKER_VERSION = 0.11.0
DOCKER_TAG = $(DOCKER_IMAGE):$(DOCKER_VERSION)

all: vet

generate:
	$(GO) generate $(GO_FLAGS) $(GO_ARGS)

build: generate
	$(GO) build $(GO_FLAGS) $(GO_BUILD_ARGS) -o "$(TARGET)"

test: build
	$(GO) test $(GO_FLAGS) $(GO_ARGS)

install: test
	$(GO) install $(GO_FLAGS) $(GO_ARGS)

vet: install
	$(GO) vet $(GO_FLAGS) $(GO_ARGS)

$(DOCKER_TARGET): clean-local
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 $(GO) build $(GO_FLAGS) $(GO_BUILD_ARGS) -a --installsuffix cgo --ldflags="-s" -o "$(DOCKER_TARGET)"

docker-target: $(DOCKER_TARGET)

docker-build: docker-target
	cd docker && docker build -t "$(DOCKER_TAG)" .

docker: docker-build
	docker push "$(DOCKER_TAG)"

clean: clean-local
	$(GO) clean $(GO_FLAGS) $(GO_ARGS)

clean-local:
	-rm -f "$(DOCKER_TARGET)"

.PHONY: all fast clean build test vet
.PHONY: docker docker-target docker-build docker-push
.PHONY: clean-local
`;
            const p = InMemoryProject.of(
                { path: "cmd/version.go", content: v },
                { path: "Makefile", content: m },
            );
            const l: ProgressLog = { write: () => { return; } } as any;
            const r = await goIncrementPatch(p, l);
            assert(r.code === 0);
            assert(r.message === "Incremented patch level: 0.11.0 => 0.11.1");
            const rv = await (await p.getFile("cmd/version.go")).getContent();
            const ev = `// Copyright © 2018 Atomist
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
)

const (
	pkg     = "k8svent"
	version = "0.11.1"
)

// versionCmd represents the version command
var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Print version and exit",
	Long:  "Print the package name and version in the standard format.",
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println(pkg, version)
	},
}

func init() {
	RootCmd.AddCommand(versionCmd)
}
`;
            assert(rv === ev);
            const rm = await (await p.getFile("Makefile")).getContent();
            const em = `# Makefile for Travis CI

GO = go
GO_FLAGS = -v
GO_ARGS = $(shell go list ./...)
GO_BUILD_ARGS =

TARGET = k8svent
DOCKER_TARGET = docker/$(TARGET)
DOCKER_IMAGE = atomist/$(TARGET)
DOCKER_VERSION = 0.11.1
DOCKER_TAG = $(DOCKER_IMAGE):$(DOCKER_VERSION)

all: vet

generate:
	$(GO) generate $(GO_FLAGS) $(GO_ARGS)

build: generate
	$(GO) build $(GO_FLAGS) $(GO_BUILD_ARGS) -o "$(TARGET)"

test: build
	$(GO) test $(GO_FLAGS) $(GO_ARGS)

install: test
	$(GO) install $(GO_FLAGS) $(GO_ARGS)

vet: install
	$(GO) vet $(GO_FLAGS) $(GO_ARGS)

$(DOCKER_TARGET): clean-local
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 $(GO) build $(GO_FLAGS) $(GO_BUILD_ARGS) -a --installsuffix cgo --ldflags="-s" -o "$(DOCKER_TARGET)"

docker-target: $(DOCKER_TARGET)

docker-build: docker-target
	cd docker && docker build -t "$(DOCKER_TAG)" .

docker: docker-build
	docker push "$(DOCKER_TAG)"

clean: clean-local
	$(GO) clean $(GO_FLAGS) $(GO_ARGS)

clean-local:
	-rm -f "$(DOCKER_TARGET)"

.PHONY: all fast clean build test vet
.PHONY: docker docker-target docker-build docker-push
.PHONY: clean-local
`;
            assert(rm === em);
        });

        it("should fail to find the file", async () => {
            const p = InMemoryProject.of({ path: "version.go", content: `` });
            const l: ProgressLog = { write: () => { return; } } as any;
            const r = await goIncrementPatch(p, l);
            assert(r.code === 1);
            assert(r.message === "Project does not have 'cmd/version.go' file");
        });

        it("should fail to find the version", async () => {
            const p = InMemoryProject.of(
                { path: "cmd/version.go", content: `` },
                { path: "Makefile", content: `` },
            );
            const l: ProgressLog = { write: () => { return; } } as any;
            const r = await goIncrementPatch(p, l);
            assert(r.code === 1);
            assert(r.message === "Failed to extract version from 'cmd/version.go' file");
        });

        it("should fail to find the Makefile", async () => {
            const p = InMemoryProject.of({ path: "cmd/version.go", content: `\tversion = "16.8.3"` });
            const l: ProgressLog = { write: () => { return; } } as any;
            const r = await goIncrementPatch(p, l);
            assert(r.code === 1);
            assert(r.message === "Project does not have 'Makefile' file");
        });

    });

});
