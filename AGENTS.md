# PROJECT KNOWLEDGE BASE

## OVERVIEW

Project: **suenyiyang-pi-preset** — an npm package that bundles personal Pi coding-agent
resources (extensions / skills / prompts / themes) plus a set of third-party Pi packages,
so one `pi install` loads everything.
Stack: Node.js ESM (`"type": "module"`), no build step, no framework. Tests use the
built-in `node:test`. Release automation is GitHub Actions + npm Trusted Publisher (OIDC).

## STRUCTURE

*   `package.json` — the single source of truth: version, `pi` manifest, `dependencies`,
    `bundleDependencies`, `files`.
*   `extensions/` — own extensions: `tps-status.ts` (live tokens/sec in footer),
    `auto-session-title.ts` (auto session naming, configurable via
    `~/.pi/agent/auto-session-title.json`).
*   `skills/`, `prompts/`, `themes/` — own resources (currently `.gitkeep` placeholders).
*   `.github/scripts/generate-release-notes.mjs` — dependency-free Conventional-Commits →
    Markdown release-notes generator (CLI + exported pure functions).
*   `.github/scripts/generate-release-notes.test.mjs` — its tests, kept beside the script.
*   `test/generate-release-notes.test.mjs` — wrapper so `node --test` finds them from the repo root.
*   `.github/workflows/daily-release.yml` — the whole release pipeline.
*   `README.md` — user-facing, written in Chinese; update it when the install/release flow changes.

## COMMANDS

| Action           | Command |
|------------------|---------|
| Install          | `npm ci` |
| Test             | `node --test` |
| Build            | none (nothing is compiled) |
| Load locally     | `pi -e .` (session only) or `pi install .` |
| Inspect manifest | `pi config` |
| Generate notes   | `node .github/scripts/generate-release-notes.mjs --base-ref <ref> --head-ref <ref> --tag <tag> --repository owner/repo --output -` |

## CODING STANDARDS

*   **Language**: ESM only, `node:`-prefixed builtin imports. Extensions may be TypeScript
    (Pi loads `.ts` natively); CI scripts stay plain `.mjs`.
*   **Style**: match surrounding style; small exported pure functions with git/filesystem
    work isolated in wrappers.
*   **Scripts stay dependency-free**: stdlib + `node:test` + `node:assert/strict` only.
*   **Commits**: Conventional Commits (`feat(scope): ...`, `fix(ci): ...`). This feeds the
    release-notes grouping (`feat`→Features, `fix`→Fixes, `perf`→Performance,
    `docs`→Documentation, everything else→Maintenance).

## NOTES

*   **Pushing to `main` publishes to npm** (once Trusted Publisher is configured). Any push
    triggers a release; if the current version already exists on npm, CI bumps patch,
    commits `chore(release): X.Y.Z`, tags `vX.Y.Z`, pushes, and creates the GitHub Release.
    Until then, `pi install git:github.com/suenyiyang/suenyiyang-pi` works without npm.
*   Bundle a new Pi package by adding it to `dependencies` **and** `bundleDependencies`, then
    pointing `pi.extensions` / `pi.skills` / `pi.prompts` at its `node_modules/...` path.
    npm-hosted deps use semver ranges; git-hosted deps use `github:owner/repo` specs.
*   Pi core packages (`@earendil-works/pi-*`, `typebox`) belong in `peerDependencies` as
    `"*"` and stay unbundled.
*   `.npmrc` sets `force=true` because bundled Pi packages sometimes pin **stale** peer
    ranges on Pi core packages the runtime provides. `force` tolerates the conflict and
    still installs the peer tree. Do **not** switch to `legacy-peer-deps`.
*   Release-note text is Markdown-escaped on purpose — commit subjects are
    attacker-influenced input into `gh release create`.
*   Auth is OIDC — **never** add `NPM_TOKEN` or other secrets to the repo.
*   Git commits in this repo use the GitHub identity (`suenyiyang
    <suenyiyang+github@gmail.com>`), configured repo-locally, not the global git identity.

## SELF-CHECK

`node --test` must pass before claiming the release-notes generator works.
