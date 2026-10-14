import fs from "node:fs";
import { spawnSync } from "node:child_process";
import process from "node:process";
import { pathToFileURL } from "node:url";

const GITHUB_SPEC = /^github:([^/#]+)\/([^#]+)#([^\s]+)$/;
const COMMIT_SPEC = /^[0-9a-f]{40}$/i;

/**
 * Parse a floating GitHub dependency spec. Commit-pinned specs are skipped
 * because refreshing them would change the requested revision, not just the lock.
 */
export function parseGitHubDependency(spec) {
  if (typeof spec !== "string") return null;
  const match = GITHUB_SPEC.exec(spec);
  if (!match) return null;
  const [, owner, repo, ref] = match;
  if (COMMIT_SPEC.test(ref)) return null;
  return { owner, repo, ref };
}

export function revisionFromResolved(resolved) {
  if (typeof resolved !== "string") return null;
  const match = /#([0-9a-f]{40})$/i.exec(resolved);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Return install specs whose locked commit differs from the remote ref.
 * `remoteRevisions` is keyed by `owner/repo#ref`.
 */
export function staleGitInstallSpecs({ dependencies, lockPackages, remoteRevisions }) {
  const specs = [];

  for (const [name, spec] of Object.entries(dependencies ?? {})) {
    const parsed = parseGitHubDependency(spec);
    if (!parsed) continue;

    const key = `${parsed.owner}/${parsed.repo}#${parsed.ref}`;
    const remote = remoteRevisions?.[key];
    if (!remote) {
      throw new Error(`Missing remote revision for ${key}.`);
    }

    const locked = revisionFromResolved(lockPackages?.[`node_modules/${name}`]?.resolved);
    if (locked !== remote.toLowerCase()) {
      specs.push(`${name}@${spec}`);
    }
  }

  return specs;
}

export function parseArgs(argv) {
  const options = {
    packageJson: "package.json",
    packageLock: "package-lock.json",
    remoteRevisions: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") return { help: true };
    if (argument === "--package-json") {
      options.packageJson = requiredValue(argv, ++index, argument);
      continue;
    }
    if (argument === "--package-lock") {
      options.packageLock = requiredValue(argv, ++index, argument);
      continue;
    }
    if (argument === "--remote") {
      options.remoteRevisions ??= {};
      const value = requiredValue(argv, ++index, argument);
      const separator = value.lastIndexOf("=");
      if (separator <= 0) throw new Error(`Expected owner/repo#ref=sha, got ${value}`);
      options.remoteRevisions[value.slice(0, separator)] = value.slice(separator + 1);
      continue;
    }
    throw new Error(`Unexpected argument: ${argument}`);
  }

  return options;
}

function requiredValue(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value.`);
  return value;
}

export function remoteRevision(owner, repo, ref, spawn = spawnSync) {
  const url = `https://github.com/${owner}/${repo}.git`;
  const candidates = [`refs/heads/${ref}`, `refs/tags/${ref}`];

  for (const qualified of candidates) {
    const result = spawn("git", ["ls-remote", url, qualified], { encoding: "utf8" });
    if (result.status !== 0) {
      throw new Error(result.stderr || `git ls-remote failed for ${url} ${qualified}`);
    }
    const sha = String(result.stdout ?? "").trim().split(/\s+/)[0];
    if (sha) return sha.toLowerCase();
  }

  throw new Error(`No branch or tag ${ref} on ${owner}/${repo}.`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function listStaleGitInstallSpecs(options, spawn = spawnSync) {
  const manifest = readJson(options.packageJson);
  const lock = readJson(options.packageLock);
  const remoteRevisions = { ...(options.remoteRevisions ?? {}) };

  for (const spec of Object.values(manifest.dependencies ?? {})) {
    const parsed = parseGitHubDependency(spec);
    if (!parsed) continue;
    const key = `${parsed.owner}/${parsed.repo}#${parsed.ref}`;
    if (remoteRevisions[key]) continue;
    remoteRevisions[key] = remoteRevision(parsed.owner, parsed.repo, parsed.ref, spawn);
  }

  return staleGitInstallSpecs({
    dependencies: manifest.dependencies,
    lockPackages: lock.packages,
    remoteRevisions,
  });
}

function printHelp() {
  process.stdout.write(`Usage: node .github/scripts/git-dependency-updates.mjs [options]

Print name@spec lines for direct github:owner/repo#ref dependencies whose
package-lock commit differs from the remote branch or tag.

Options:
  --package-json <path>     Default: package.json
  --package-lock <path>     Default: package-lock.json
  --remote <owner/repo#ref=sha>
                            Use this revision instead of git ls-remote. Repeatable.
`);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  const specs = listStaleGitInstallSpecs(options);
  if (specs.length > 0) process.stdout.write(`${specs.join("\n")}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
