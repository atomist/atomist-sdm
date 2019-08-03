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

import {
    InMemoryProject,
} from "@atomist/automation-client";
import {
    PushListenerInvocation,
} from "@atomist/sdm";
import * as appRoot from "app-root-path";
import * as path from "path";
import * as assert from "power-assert";
import {
    fileSha256,
    HasHomebrewFormula,
    restoreBottles,
} from "../../lib/machine/homebrewSupport";

describe("homebrewSupport", () => {

    describe("HasHomeBrewFormula", () => {

        it("should not find a formula in an empty project", async () => {
            const p = InMemoryProject.of();
            const pi: PushListenerInvocation = { project: p } as any;
            const r = await HasHomebrewFormula.mapping(pi);
            assert(!r);
        });

        it("should not find a formula in a project without one", async () => {
            const p = InMemoryProject.of(
                { path: "package.json", content: "{}" },
                { path: "README.md", content: "# Nothing to see here\n" },
                { path: "src/stuff.rb", content: "# Nothing to see here\n" },
            );
            const pi: PushListenerInvocation = { project: p } as any;
            const r = await HasHomebrewFormula.mapping(pi);
            assert(!r);
        });

        it("should find a formula", async () => {
            const p = InMemoryProject.of(
                { path: "package.json", content: "{}" },
                { path: ".atomist/homebrew/cli.rb", content: "# Nothing to see here\n" },
                { path: "README.md", content: "# Nothing to see here\n" },
            );
            const pi: PushListenerInvocation = { project: p } as any;
            const r = await HasHomebrewFormula.mapping(pi);
            assert(r);
        });

        it("should return true if multiple formula exist", async () => {
            const p = InMemoryProject.of(
                { path: "package.json", content: "{}" },
                { path: ".atomist/homebrew/cli.rb", content: "# Nothing to see here\n" },
                { path: "README.md", content: "# Nothing to see here\n" },
                { path: "src/stuff.rb", content: "# Nothing to see here\n" },
                { path: ".atomist/homebrew/other.rb", content: "# Nothing to see here\n" },
            );
            const pi: PushListenerInvocation = { project: p } as any;
            const r = await HasHomebrewFormula.mapping(pi);
            assert(r);
        });

    });

    describe("fileSha256", () => {

        it("should compute the proper hash", async () => {
            const sha = await fileSha256(path.join(appRoot.path, "LICENSE"));
            const e = "cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30";
            assert(sha === e);
        });

    });

    describe("restoreBottles", () => {

        const l: any = { write: () => { } };

        it("should remove bottle section if no bottles", () => {
            const u = `require "language/node"

class AtomistCli < Formula
  desc "The Atomist CLI"
  homepage "https://github.com/atomist/cli#readme"
  url "https://registry.npmjs.org/@atomist/cli/-/@atomist/cli-1.6.1.tgz"
  sha256 "b39f35a9fb3df8e994840f381848f4cc3d209c8d10da315d314e3aa2ae03e643"

  bottle do
  end

  depends_on "node"

  def install
    system "npm", "install", *Language::Node.std_npm_install_args(libexec)
    bin.install_symlink Dir["#{libexec}/bin/*"]
    bash_completion.install "#{libexec}/lib/node_modules/@atomist/cli/assets/bash_completion/atomist"
  end

  test do
    assert_predicate bin/"atomist", :exist?
    assert_predicate bin/"atomist", :executable?
    skill_output = shell_output("#{bin}/atomist show skills")
    assert_match(/\d+ commands are available from \d+ connected SDMs/, skill_output)
  end
end
`;
            const b = `require "language/node"

class AtomistCli < Formula
  desc "The Atomist CLI"
  homepage "https://github.com/atomist/cli#readme"
  url "https://registry.npmjs.org/@atomist/cli/-/@atomist/cli-1.6.0.tgz"
  sha256 "0c00e070c8525df747676ea30241c772631c622664b26146f313fe1019778adb"

  depends_on "node"

  def install
    system "npm", "install", *Language::Node.std_npm_install_args(libexec)
    bin.install_symlink Dir["#{libexec}/bin/*"]
    bash_completion.install "#{libexec}/lib/node_modules/@atomist/cli/assets/bash_completion/atomist"
  end

  test do
    assert_predicate bin/"atomist", :exist?
    assert_predicate bin/"atomist", :executable?
    skill_output = shell_output("#{bin}/atomist show skills")
    assert_match(/\d+ commands are available from \d+ connected SDMs/, skill_output)
  end
end
`;
            const n = restoreBottles(u, b, l);
            const e = `require "language/node"

class AtomistCli < Formula
  desc "The Atomist CLI"
  homepage "https://github.com/atomist/cli#readme"
  url "https://registry.npmjs.org/@atomist/cli/-/@atomist/cli-1.6.1.tgz"
  sha256 "b39f35a9fb3df8e994840f381848f4cc3d209c8d10da315d314e3aa2ae03e643"

  depends_on "node"

  def install
    system "npm", "install", *Language::Node.std_npm_install_args(libexec)
    bin.install_symlink Dir["#{libexec}/bin/*"]
    bash_completion.install "#{libexec}/lib/node_modules/@atomist/cli/assets/bash_completion/atomist"
  end

  test do
    assert_predicate bin/"atomist", :exist?
    assert_predicate bin/"atomist", :executable?
    skill_output = shell_output("#{bin}/atomist show skills")
    assert_match(/\d+ commands are available from \d+ connected SDMs/, skill_output)
  end
end
`;
            assert(n === e);
        });

        it("should handle surrounding lines properly", () => {
            const u = `require "language/node"

class AtomistCli < Formula
  desc "The Atomist CLI"
  homepage "https://github.com/atomist/cli#readme"
  url "https://registry.npmjs.org/@atomist/cli/-/@atomist/cli-1.6.1.tgz"
  sha256 "b39f35a9fb3df8e994840f381848f4cc3d209c8d10da315d314e3aa2ae03e643"

  bottle do
  end
  depends_on "node"

  def install
    system "npm", "install", *Language::Node.std_npm_install_args(libexec)
    bin.install_symlink Dir["#{libexec}/bin/*"]
    bash_completion.install "#{libexec}/lib/node_modules/@atomist/cli/assets/bash_completion/atomist"
  end

  test do
    assert_predicate bin/"atomist", :exist?
    assert_predicate bin/"atomist", :executable?
    skill_output = shell_output("#{bin}/atomist show skills")
    assert_match(/\d+ commands are available from \d+ connected SDMs/, skill_output)
  end
end
`;
            const b = `require "language/node"

class AtomistCli < Formula
  desc "The Atomist CLI"
  homepage "https://github.com/atomist/cli#readme"
  url "https://registry.npmjs.org/@atomist/cli/-/@atomist/cli-1.6.0.tgz"
  sha256 "0c00e070c8525df747676ea30241c772631c622664b26146f313fe1019778adb"

  depends_on "node"

  def install
    system "npm", "install", *Language::Node.std_npm_install_args(libexec)
    bin.install_symlink Dir["#{libexec}/bin/*"]
    bash_completion.install "#{libexec}/lib/node_modules/@atomist/cli/assets/bash_completion/atomist"
  end

  test do
    assert_predicate bin/"atomist", :exist?
    assert_predicate bin/"atomist", :executable?
    skill_output = shell_output("#{bin}/atomist show skills")
    assert_match(/\d+ commands are available from \d+ connected SDMs/, skill_output)
  end
end
`;
            const n = restoreBottles(u, b, l);
            const e = `require "language/node"

class AtomistCli < Formula
  desc "The Atomist CLI"
  homepage "https://github.com/atomist/cli#readme"
  url "https://registry.npmjs.org/@atomist/cli/-/@atomist/cli-1.6.1.tgz"
  sha256 "b39f35a9fb3df8e994840f381848f4cc3d209c8d10da315d314e3aa2ae03e643"

  depends_on "node"

  def install
    system "npm", "install", *Language::Node.std_npm_install_args(libexec)
    bin.install_symlink Dir["#{libexec}/bin/*"]
    bash_completion.install "#{libexec}/lib/node_modules/@atomist/cli/assets/bash_completion/atomist"
  end

  test do
    assert_predicate bin/"atomist", :exist?
    assert_predicate bin/"atomist", :executable?
    skill_output = shell_output("#{bin}/atomist show skills")
    assert_match(/\d+ commands are available from \d+ connected SDMs/, skill_output)
  end
end
`;
            assert(n === e);
        });

        it("should restore bottles", () => {
            const u = `require "language/node"

class AtomistCli < Formula
  desc "The Atomist CLI"
  homepage "https://github.com/atomist/cli#readme"
  url "https://registry.npmjs.org/@atomist/cli/-/@atomist/cli-1.6.1.tgz"
  sha256 "b39f35a9fb3df8e994840f381848f4cc3d209c8d10da315d314e3aa2ae03e643"

  bottle do
  end

  depends_on "node"

  def install
    system "npm", "install", *Language::Node.std_npm_install_args(libexec)
    bin.install_symlink Dir["#{libexec}/bin/*"]
    bash_completion.install "#{libexec}/lib/node_modules/@atomist/cli/assets/bash_completion/atomist"
  end

  test do
    assert_predicate bin/"atomist", :exist?
    assert_predicate bin/"atomist", :executable?
    skill_output = shell_output("#{bin}/atomist show skills")
    assert_match(/\d+ commands are available from \d+ connected SDMs/, skill_output)
  end
end
`;
            const b = `require "language/node"

class AtomistCli < Formula
  desc "The Atomist CLI"
  homepage "https://github.com/atomist/cli#readme"
  url "https://registry.npmjs.org/@atomist/cli/-/@atomist/cli-1.6.0.tgz"
  sha256 "0c00e070c8525df747676ea30241c772631c622664b26146f313fe1019778adb"

  bottle do
    sha256 "d97ef831aabff6973eac7b8cb4e8897d2f9fe3d8e4018caa5f1c8967b31b2578" => :mojave
    sha256 "e2f4ddb68c20300ff2b813d4ca5837d07461128a76464e454ed2bdb7299e8bfa" => :high_sierra
    sha256 "ba75cca5cecc972f32c8e83da84c81f1c5de55a4f258d47c90c13ccdfa3966b5" => :sierra
  end

  depends_on "node"

  def install
    system "npm", "install", *Language::Node.std_npm_install_args(libexec)
    bin.install_symlink Dir["#{libexec}/bin/*"]
    bash_completion.install "#{libexec}/lib/node_modules/@atomist/cli/assets/bash_completion/atomist"
  end

  test do
    assert_predicate bin/"atomist", :exist?
    assert_predicate bin/"atomist", :executable?
    skill_output = shell_output("#{bin}/atomist show skills")
    assert_match(/\d+ commands are available from \d+ connected SDMs/, skill_output)
  end
end
`;
            const n = restoreBottles(u, b, l);
            const e = `require "language/node"

class AtomistCli < Formula
  desc "The Atomist CLI"
  homepage "https://github.com/atomist/cli#readme"
  url "https://registry.npmjs.org/@atomist/cli/-/@atomist/cli-1.6.1.tgz"
  sha256 "b39f35a9fb3df8e994840f381848f4cc3d209c8d10da315d314e3aa2ae03e643"

  bottle do
    sha256 "d97ef831aabff6973eac7b8cb4e8897d2f9fe3d8e4018caa5f1c8967b31b2578" => :mojave
    sha256 "e2f4ddb68c20300ff2b813d4ca5837d07461128a76464e454ed2bdb7299e8bfa" => :high_sierra
    sha256 "ba75cca5cecc972f32c8e83da84c81f1c5de55a4f258d47c90c13ccdfa3966b5" => :sierra
  end

  depends_on "node"

  def install
    system "npm", "install", *Language::Node.std_npm_install_args(libexec)
    bin.install_symlink Dir["#{libexec}/bin/*"]
    bash_completion.install "#{libexec}/lib/node_modules/@atomist/cli/assets/bash_completion/atomist"
  end

  test do
    assert_predicate bin/"atomist", :exist?
    assert_predicate bin/"atomist", :executable?
    skill_output = shell_output("#{bin}/atomist show skills")
    assert_match(/\d+ commands are available from \d+ connected SDMs/, skill_output)
  end
end
`;
            assert(n === e);
        });

    });

});
