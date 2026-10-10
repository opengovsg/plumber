---
name: bump-dependency
description: Research and safely apply pnpm dependency version bumps across the Plumber monorepo (root, backend, frontend, types). Use when the user asks to bump/update/upgrade a package, asks whether a version bump has breaking changes, or wants a dependency security patch applied.
---

# Bump Dependency

Safely evaluate and apply a dependency version bump. Never skip the research
and impact-check steps, even for "just a patch" bumps.

## Step 0 — Resolve the package name and target version

The invocation argument (e.g. `/bump-dependency <name>`) is the literal
package name. Take it at face value and confirm it with `grep`/`pnpm why`
before interpreting it any other way. Don't let recent conversation
context reinterpret it (e.g. a bare word that also reads as an ordinary
English adjective, or resembles a package discussed earlier in the
session). Verify against `pnpm-workspace.yaml` and `pnpm-lock.yaml` first.

Don't ask the user for a target version up front. Resolve it yourself:

1. Run `pnpm audit --json` at the repo root. If the package shows up with
   a recommended fix (`fixAvailable`), that recommended version is the
   default target. A major bump is allowed here, because it is the minimum
   needed to clear the advisory.
2. If the package isn't flagged by `pnpm audit`, prefer staying within the
   **current major version line**: use the latest minor/patch release on
   that line (`pnpm view <package>@<current-major> version`, or the
   highest entry for that major from `pnpm view <package> versions --json`)
   as the default target, not the absolute latest major. Only reach past
   the current major if the user explicitly asks for the newest version
   or there's a concrete reason the current major can't be kept (e.g. it's
   deprecated/unsupported upstream).
3. `minimumReleaseAge` is 2880 minutes. `pnpm install` rejects a version
   published less than two days ago. If the target is younger than that,
   wait, or tell the user the install will fail.
4. Either way, proceed straight into Step 1–4 research/impact-check using
   that resolved target — only surface the version as an explicit
   decision point in Step 4 if it turns out to be a **major** bump over
   the current version (major bumps carry real migration risk and are
   worth a deliberate go/no-go from the user; patch/minor bumps aren't).

## Step 1 — Classify the dependency

Check whether the package is **direct** or **transitive**:

- Direct: a workspace `package.json` lists it. The version usually lives
  in `pnpm-workspace.yaml` under `catalog:` or `catalogs:`, and the
  `package.json` specifier is `catalog:` or `catalog:<name>`. A few
  packages (for example `tools/langfuse`) still pin an exact version in
  their own `package.json`.
- Transitive: it appears in `pnpm-lock.yaml` and is not declared by any
  workspace. Confirm with `pnpm why <package>`. It may already have an
  exact entry under `overrides:` in `pnpm-workspace.yaml`.

An `overrides:` entry wins over the catalog. If you change only the
catalog, `pnpm install` keeps the override version and the bump does not
take effect.

## Step 2 — Research breaking changes

For the version range being bumped (current → target), find and summarize:

- Official changelog / release notes (GitHub releases, `CHANGELOG.md`).
- Any security advisories (GHSA/CVE) fixed in the range — note the CVE ID.
- Actual breaking API changes vs. pure internal/security/perf fixes. Read
  more than just the target version — check every version in between, since
  intermediate releases can carry the real breaking change.

Use `WebFetch`/`WebSearch` for this. Don't rely on memory — package
changelogs are outside training-data-freshness territory.

## Step 3 — Check repo impact (always, no exceptions)

Spawn an `Explore` (or `general-purpose`) agent to search
`packages/*/src` (excluding `node_modules`/`dist`) for direct
imports/`require`s and call sites of the package. Ask it to:

- Report whether usage is direct or purely transitive-through-tooling.
- For each call site, check whether the specific behavior changes from
  Step 2 (not generic "could this break something") actually apply to the
  input that call site handles.
- Suggest concrete manual/automated tests if there's real exposure.

If the package is confirmed transitive-only (e.g. pulled in by eslint,
graphql-codegen, dd-trace, jest), say so plainly — no first-party
call sites means the changelog risk doesn't apply to Plumber's own logic,
even if the CVE itself sounds scary.

## Step 4 — Report and wait

Present to the user: what changed in the version range, whether Plumber
code is exposed, and recommended verification (`pnpm run lint`, `pnpm test`,
specific manual checks). **Do not proceed to Step 5 without the user
asking you to apply/bump/commit it.**

## Step 5 — Apply the bump (only after the user asks)

Write the exact target version (`"1.9.0"`, never `"^1.9.0"` or `"~1.9.0"`).

**Direct dependency declared with `catalog:`:**
1. Edit that package's entry in `pnpm-workspace.yaml` (`catalog:` or the
   named catalog it uses). Leave the `package.json` specifier as `catalog:`.
2. If `overrides:` has a top-level `"<package>"` key, set it to the same
   version. Skip this and the install still resolves the old pin.
3. Leave `parent>package` override keys alone unless the user is bumping
   that one edge. Those keys pin a second copy.

**Direct dependency with a version in `package.json`:**
1. Edit that `package.json` version.
2. Update a top-level override for the same package, when one exists.

**Transitive dependency:**
1. Add or update an exact `"<package>"` entry under `overrides:` in
   `pnpm-workspace.yaml`. There is no root `package.json` `overrides` block.
2. Prefer a version that still satisfies the parent's declared range. If
   the advisory fix is outside that range, the override is what forces it.

Ask explicit confirmation before `pnpm install`. Never run it unprompted.
Approving the bump is not the same as approving the install. After it
finishes, run `pnpm why <package>` and confirm the resolved version is the
target. If it is still the old version, the override was not updated.

## Step 6 — Commit (only after explicit confirmation)

- Never commit a dependency bump unprompted, even right after applying it.
- Before committing, run `git status` + `git diff --stat` and confirm the
  diff is scoped to `pnpm-workspace.yaml`, `pnpm-lock.yaml`, and any
  `package.json` whose own specifier changed. Nothing unrelated got swept
  in. Do not commit `package-lock.json`.
- Commit message: what was bumped, the CVE/behavior-change summary from
  Step 2, one line on why it's safe (from Step 3). End with
  `Co-Authored-By:` using the *current* session's actual model name — never
  copy this line from a prior commit in git history.

## Quick reference

| Situation | Command |
|---|---|
| Confirm direct vs transitive | `pnpm why <package>` |
| Where the direct version is declared | `catalog:` entry in `pnpm-workspace.yaml` |
| Make a catalog bump actually install | set the same version on the top-level `overrides:` key, then `pnpm install` |
| Force a transitive package | pin it under `overrides:` in `pnpm-workspace.yaml`, then `pnpm install` |
| Confirm the bump took effect | `pnpm why <package>` shows the target version |
