---
name: bump-dependency
description: Research and safely apply npm dependency version bumps across the Plumber monorepo (root, backend, frontend, types). Use when the user asks to bump/update/upgrade a package, asks whether a version bump has breaking changes, or wants a dependency security patch applied.
---

# Bump Dependency

Safely evaluate and apply a dependency version bump. Never skip the research
and impact-check steps, even for "just a patch" bumps.

## Step 0 — Resolve the package name and target version

The invocation argument (e.g. `/bump-dependency <name>`) is the literal
package name — take it at face value and confirm it with `grep`/`npm ls`
before interpreting it any other way. Don't let recent conversation
context reinterpret it (e.g. a bare word that also reads as an ordinary
English adjective, or resembles a package discussed earlier in the
session) — verify against `package.json`/`package-lock.json` first.

Don't ask the user for a target version up front. Resolve it yourself:

1. Run `npm audit --json` at the repo root. If the package shows up with
   a recommended fix (`fixAvailable`), that recommended version is the
   default target — even if it's a major bump, since it's the minimum
   needed to clear the advisory.
2. If the package isn't flagged by `npm audit`, prefer staying within the
   **current major version line**: use the latest minor/patch release on
   that line (`npm view <package>@<current-major> version`, or the
   highest entry for that major from `npm view <package> versions --json`)
   as the default target, not the absolute latest major. Only reach past
   the current major if the user explicitly asks for the newest version
   or there's a concrete reason the current major can't be kept (e.g. it's
   deprecated/unsupported upstream).
3. Either way, proceed straight into Step 1–4 research/impact-check using
   that resolved target — only surface the version as an explicit
   decision point in Step 4 if it turns out to be a **major** bump over
   the current version (major bumps carry real migration risk and are
   worth a deliberate go/no-go from the user; patch/minor bumps aren't).

## Step 1 — Classify the dependency

Check whether the package is **direct** or **transitive**:

- Direct: listed in `dependencies`/`devDependencies` of the root or any
  `packages/*/package.json`, pinned to an exact version (no `^`/`~`).
- Transitive: only appears in `package-lock.json` (confirm with
  `npm ls <package> --all`), not declared in any `package.json` — it may
  already have an entry in the root `package.json` `overrides` block if a
  prior bump pinned it there.

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
code is exposed, and recommended verification (`npm run lint`, `npm test`,
specific manual checks). **Do not proceed to Step 5 without the user
asking you to apply/bump/commit it.**

## Step 5 — Apply the bump (only after the user asks)

**Direct dependency:**
1. Edit the exact `package.json` (root or the owning workspace) to the new
   version. Always pin exact (`"1.9.0"`, never `"^1.9.0"` or `"~1.9.0"`) —
   this repo always pins. Use `npm install -E` if installing rather than
   hand-editing.
2. Ask explicit confirmation before running `npm install`. Never run it
   unprompted, even after the user approved the bump itself in Step 4 —
   approving the bump is not the same as approving the command.

**Transitive dependency:**
1. Prefer `npm update <package>` first — it stays within whatever range
   the parent dependency already declares.
2. If the target patched version is outside that range (common for
   security backports), add/update an exact-pinned entry for it under the
   root `package.json` `"overrides"` block instead, then apply via
   `npm install`.
3. `npm update` and `npm install` each require their own explicit
   confirmation before running — never run either unprompted, and don't
   treat approval of one as approval of the other.

## Step 6 — Commit (only after explicit confirmation)

- Never commit a dependency bump unprompted, even right after applying it.
- Before committing, run `git status` + `git diff --stat` and confirm the
  diff is scoped to exactly the intended `package.json`/`package-lock.json`
  changes — nothing unrelated got swept in.
- Commit message: what was bumped, the CVE/behavior-change summary from
  Step 2, one line on why it's safe (from Step 3). End with
  `Co-Authored-By:` using the *current* session's actual model name — never
  copy this line from a prior commit in git history.

## Quick reference

| Situation | Command |
|---|---|
| Confirm direct vs transitive | `npm ls <package> --all` |
| Bump transitive within existing range | `npm update <package>` |
| Force transitive past declared range | pin in root `overrides`, then `npm install` |
| Bump direct dependency | edit exact version in `package.json`, then `npm install` |
