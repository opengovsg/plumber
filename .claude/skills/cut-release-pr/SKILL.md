---
name: cut-release-pr
description: >
  Cut a Plumber release PR that merges `develop-v2` into `production`. Prompts
  the user to choose the version bump (patch / minor / major), bumps the version
  across the root workspace and every package via `npm version`, creates a single
  conventional `vX.Y.Z` commit + git tag locally, and prepares (or opens) the
  release PR whose body summarises the changes since the last release. Use when
  the user asks to cut/prepare a release, make a release PR, bump the version and
  release, or ship develop-v2 to production.
---

# Cut a release PR

Prepare a Plumber release: merge `develop-v2` → `production` with a version bump.

**Release model (fixed for this repo):**

- Head branch = `develop-v2` (the trunk). The release PR is opened **from
  `develop-v2` directly**, not from a feature branch.
- Base branch = `production`.
- PR title = `Release vX.Y.Z`. PR body = a terse bulleted summary of the changes
  since the previous release (one bullet per meaningful commit, keeping the
  conventional-commit prefix, e.g. `- chore: enable Datadog continuous profiling (#1805)`).
- Every release is a single commit named `vX.Y.Z` that bumps the version in the
  **root** `package.json` **and every workspace** `package.json` plus
  `package-lock.json`, tagged `vX.Y.Z`.

## Hard rules (non-negotiable)

1. **Never push, and never open the PR before the branch is pushed.** Pushing
   `develop-v2` + the tag, and shipping a production release, are owned by the
   human. Print the exact push commands and let the user run them. Do **not** run
   `git push` yourself.
2. **One clean bump commit.** The final commit must touch exactly the root
   `package.json`, `package-lock.json`, and every `packages/*/package.json`, with
   message `vX.Y.Z` (with the `v` prefix). Do not leave workspace bumps
   uncommitted — see the gotcha below.
3. **Never `git reset --hard`** (it's blocked by a deny rule anyway). Undo with a
   mixed reset + `git checkout -- .` if you need to back out a bump.
4. Only run `gh pr create` **after** confirming `origin/develop-v2` already
   contains the release commit (i.e. the user has pushed).

## Procedure

### 1. Preconditions

```bash
git fetch origin production develop-v2 --quiet
git branch --show-current          # must be: develop-v2
git status --porcelain             # must be empty (clean tree)
git rev-parse HEAD                  # must equal...
git rev-parse origin/develop-v2     # ...this (local fully synced with origin)
```

Abort and tell the user if: not on `develop-v2`, the tree is dirty, or local and
`origin/develop-v2` diverge. A release must be cut from a clean, fully-synced
`develop-v2`.

### 2. Summarise the changes since the last release

```bash
git log --oneline --no-merges origin/production..origin/develop-v2
```

This is the set of changes the release ships. Condense each commit into one PR
bullet, keeping the conventional-commit type prefix and the `(#PR)` number.
**Exclude** any existing version-bump commits (messages matching `vX.Y.Z`).
If the list is empty or surprisingly small, surface that to the user before
continuing — it may mean other branches still need to merge into `develop-v2`.

### 3. Prompt for the bump type

Read the current version (`node -p "require('./package.json').version"`) and
compute what each bump resolves to. Then use the **AskUserQuestion** tool to ask
which bump to apply, with three options — show the resulting version in each:

- **patch** — `X.Y.(Z+1)` — bug fixes / chores only.
- **minor** — `X.(Y+1).0` — new features, backwards-compatible.
- **major** — `(X+1).0.0` — breaking changes.

Recommend a default by scanning the step-2 commits: any breaking change →
recommend major; any `feat` → recommend minor; otherwise patch. Put the
recommended option first and append " (Recommended)" to its label.

### 4. Bump, commit, tag

Use `--no-git-tag-version` so npm only rewrites the version files; **you** create
the commit + tag so it's a single, correctly-named commit (see gotcha). Replace
`<bump>` with the chosen `patch`/`minor`/`major`:

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

If anything is off (e.g. workspace bumps missing, wrong message, stray tag),
back it out with a mixed reset and retry. Step 4 creates exactly one commit, so
the pre-bump commit is always `HEAD~1`:

```bash
git tag -d vX.Y.Z
git reset HEAD~1 && git checkout -- .
```

### 6. Hand the push to the user

Print these for the user to run — do **not** run them yourself:

```bash
git push origin develop-v2
git push origin vX.Y.Z
```

### 7. Open the PR (after the user has pushed)

Confirm the release commit is on origin, and that no release PR is already open:

```bash
git fetch origin develop-v2 --quiet
git merge-base --is-ancestor HEAD origin/develop-v2 && echo pushed || echo "NOT pushed yet"
git ls-remote --tags origin "v$NEW" | grep -q . && echo "tag pushed" || echo "TAG NOT pushed yet"
gh pr list --base production --head develop-v2 --state open
```

Once `pushed` and no open PR exists, create it:

```bash
gh pr create --base production --head develop-v2 \
  --title "Release vX.Y.Z" \
  --body "- <bullet 1>
- <bullet 2>"
```

Report the PR URL back to the user.

## Gotcha: `npm version --workspaces` quirk

`npm version <bump> --workspaces --include-workspace-root` (with its default git
tagging) rewrites **all** the `package.json` files in the working tree but
commits **only the root** `package.json` + lockfile, leaving the workspace bumps
uncommitted — and a global `message=%s` config drops the conventional `v`
prefix. That's why step 4 uses `--no-git-tag-version` and does the `git add` /
`git commit` / `git tag` manually: it folds every version file into one commit
with the correct `vX.Y.Z` message, deterministically.
