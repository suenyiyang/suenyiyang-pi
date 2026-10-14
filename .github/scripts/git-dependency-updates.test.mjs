import assert from "node:assert/strict";
import test from "node:test";

import {
  listStaleGitInstallSpecs,
  parseArgs,
  parseGitHubDependency,
  revisionFromResolved,
  staleGitInstallSpecs,
} from "./git-dependency-updates.mjs";

test("parseGitHubDependency accepts floating branch specs only", () => {
  assert.deepEqual(parseGitHubDependency("github:suenyiyang/pi-codex-tool-folding#main"), {
    owner: "suenyiyang",
    repo: "pi-codex-tool-folding",
    ref: "main",
  });
  assert.equal(parseGitHubDependency("github:owner/repo#0123456789abcdef0123456789abcdef01234567"), null);
  assert.equal(parseGitHubDependency("^1.2.3"), null);
});

test("revisionFromResolved reads the locked commit", () => {
  assert.equal(
    revisionFromResolved("git+ssh://git@github.com/owner/repo.git#48b4dbe382b655e05118a801c134193bfc62f923"),
    "48b4dbe382b655e05118a801c134193bfc62f923",
  );
  assert.equal(revisionFromResolved("https://registry.npmjs.org/pkg/-/pkg-1.0.0.tgz"), null);
});

test("staleGitInstallSpecs returns only dependencies whose commit moved", () => {
  const specs = staleGitInstallSpecs({
    dependencies: {
      floating: "github:owner/floating#main",
      current: "github:owner/current#main",
      registry: "^1.0.0",
    },
    lockPackages: {
      "node_modules/floating": {
        resolved: "git+ssh://git@github.com/owner/floating.git#aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      },
      "node_modules/current": {
        resolved: "git+https://github.com/owner/current.git#bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      },
    },
    remoteRevisions: {
      "owner/floating#main": "cccccccccccccccccccccccccccccccccccccccc",
      "owner/current#main": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    },
  });

  assert.deepEqual(specs, ["floating@github:owner/floating#main"]);
});

test("listStaleGitInstallSpecs can use injected remote revisions", () => {
  const specs = listStaleGitInstallSpecs(
    {
      packageJson: new URL("./git-dependency-updates.test.fixture-package.json", import.meta.url),
      packageLock: new URL("./git-dependency-updates.test.fixture-lock.json", import.meta.url),
      remoteRevisions: {
        "owner/floating#main": "cccccccccccccccccccccccccccccccccccccccc",
      },
    },
    () => {
      throw new Error("git ls-remote should not run when revisions are injected");
    },
  );

  assert.deepEqual(specs, ["floating@github:owner/floating#main"]);
});

test("parseArgs collects repeated remote revisions", () => {
  const options = parseArgs([
    "--remote",
    "owner/repo#main=abc",
    "--remote",
    "owner/other#v1=def",
  ]);
  assert.deepEqual(options.remoteRevisions, {
    "owner/repo#main": "abc",
    "owner/other#v1": "def",
  });
});
