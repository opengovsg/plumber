---
name: publish-release
description: >
  Publish a Plumber production release. Prompts the user to choose the version
  bump (patch / minor / major), bumps the version across the root workspace and
  every package via `npm version`, creates a single conventional `vX.Y.Z` commit
  and git tag, pushes both to origin, then opens a draft GitHub release whose
  notes summarise the changes since the previous release. Use when the user asks
  to cut or publish a release, bump the version and release, tag a release, or
  ship develop-v2 to production.
---

# Publish a release

Ship Plumber to production by publishing a GitHub release from a version tag.

**Release model (fixed for this repo):**

- Releases ship from `develop-v2` (the trunk). There is no release PR. Nothing
  merges into `production`.
- The version bump is exactly one commit on `develop-v2`, named `vX.Y.Z`. It
  bumps the root `package.json`, every workspace `package.json`, and
  `package-lock.json` together. Bundling them keeps the tag on a tree where all
  version files agree.
- That commit is tagged `vX.Y.Z`. Both the commit and the tag are pushed to
  origin.
- The GitHub release is created from that tag as a **draft**. The human
  publishes it.
- Publishing fires `release: [released]`, which runs
  [.github/workflows/deploy-production.yml](../../../.github/workflows/deploy-production.yml).
  **Publishing is the production deploy.**

## Hard rules (non-negotiable)

1. **Never publish the release.** You create the draft. The human clicks
   Publish, because that deploys to production. Never run `gh release create`
   without `--draft`. Never run `gh release edit --draft=false`.
2. **Push only `develop-v2` and the `vX.Y.Z` tag.** Never force-push. Never push
   any other branch.
3. **One clean bump commit.** The commit must touch exactly the root
   `package.json`, `package-lock.json`, and every `packages/*/package.json`. Its
   message is `vX.Y.Z` (with the `v` prefix). Do not leave workspace bumps
   uncommitted. See the gotcha below.
4. **Never `git reset --hard`** (a deny rule blocks it anyway). Back a bump out
   with a mixed reset plus `git checkout -- .`.
5. **Never bump or tag before step 1 passes.** A release must be cut from a
   clean, fully-synced `develop-v2`.

## Procedure

Run each fenced block as a single command. Shell variables do not persist
between tool calls.

### 1. Preconditions

```bash
git fetch origin develop-v2 --tags --quiet
git branch --show-current          # must be: develop-v2
git status --porcelain             # must be empty (clean tree)
git rev-parse HEAD                 # must equal...
git rev-parse origin/develop-v2    # ...this (local fully synced with origin)
```

Abort and tell the user if: not on `develop-v2`, the tree is dirty, or local and
`origin/develop-v2` diverge.

### 2. Summarise the changes since the previous release

```bash
PREV=$(git describe --tags --abbrev=0 --match "v*") && echo "since $PREV" && git log --oneline --no-merges "$PREV"..HEAD
```

This is the set of changes the release ships. Condense each commit into one
release-note bullet. Keep the conventional-commit type prefix and the `(#PR)`
number, e.g. `- chore: enable Datadog continuous profiling (#1805)`.
**Exclude** version-bump commits (messages matching `vX.Y.Z`).

If the list is empty or surprisingly small, surface that to the user before
continuing. It may mean other branches still need to merge into `develop-v2`.

### 3. Prompt for the bump type

Read the current version (`node -p "require('./package.json').version"`) and
compute what each bump resolves to. Then use the **AskUserQuestion** tool to ask
which bump to apply, with three options. Show the resulting version in each:

- **patch** (`X.Y.(Z+1)`) for bug fixes and chores only.
- **minor** (`X.(Y+1).0`) for new features, backwards-compatible.
- **major** (`(X+1).0.0`) for breaking changes.

Recommend a default by scanning the step-2 commits. Any breaking change
recommends major. Any `feat` recommends minor. Otherwise patch. Put the
recommended option first and append " (Recommended)" to its label.

### 4. Bump, commit, tag

Use `--no-git-tag-version` so npm only rewrites the version files. **You** create
the commit and tag, so it is a single correctly-named commit (see gotcha).
Replace `<bump>` with the chosen `patch`/`minor`/`major`:

```bash
npm version <bump> --workspaces --include-workspace-root --no-git-tag-version
NEW=$(node -p "require('./package.json').version")
git add package.json package-lock.json packages/*/package.json
git commit -m "v$NEW"
git tag "v$NEW"
```

### 5. Verify

```bash
git show --stat HEAD        # expect: root package.json + every packages/*/package.json + package-lock.json; message "vX.Y.Z"
git tag --points-at HEAD    # expect: vX.Y.Z
git status --porcelain      # expect: empty
```

If anything is off (workspace bumps missing, wrong message, stray tag), back it
out and retry. Step 4 creates exactly one commit, so the pre-bump commit is
always `HEAD~1`:

```bash
git tag -d vX.Y.Z
git reset HEAD~1 && git checkout -- .
```

### 6. Push the commit and the tag

```bash
git push origin develop-v2
git push origin vX.Y.Z
```

Pushing the tag does not deploy. Only publishing the release does.

### 7. Create the draft release

Confirm the tag reached origin, and that no release already exists for it:

```bash
git ls-remote --tags origin "vX.Y.Z" | grep -q . && echo "tag on origin" || echo "TAG NOT on origin"
gh release view "vX.Y.Z" --json isDraft,url 2>/dev/null || echo "no existing release"
```

If the tag is missing from origin, stop. `gh release create` would otherwise
create its own tag from the default branch.

Write the step-2 bullets to a notes file with the **Write** tool, then:

```bash
gh release create "vX.Y.Z" --draft --title "vX.Y.Z" --notes-file <path-to-notes>
```

### 8. Hand the publish to the user

Report the draft release URL. State plainly that clicking Publish deploys
`vX.Y.Z` to production, and that no deploy runs until they do.

## Escape hatch: releasing without deploying

`deploy-production.yml` listens for `released`, not `published`. A release marked
pre-release (`--prerelease`) publishes without deploying. Un-checking
"pre-release" later fires `released` and deploys then.

## Gotcha: `npm version --workspaces` quirk

`npm version <bump> --workspaces --include-workspace-root` (with its default git
tagging) rewrites **all** the `package.json` files in the working tree. It
commits **only the root** `package.json` and lockfile, leaving the workspace
bumps uncommitted. A global `message=%s` config also drops the conventional `v`
prefix. That is why step 4 uses `--no-git-tag-version` and runs `git add`,
`git commit`, and `git tag` manually. It folds every version file into one
commit with the correct `vX.Y.Z` message, deterministically.

## Gotcha: workflow-created releases do not deploy

A release created by a workflow using the default `GITHUB_TOKEN` fires no
`release` event. Create releases with your own `gh` credentials or a GitHub App
token.
