---
name: publish-release
description: >
  Publish a Plumber production release. Prompts the user to choose the version
  bump (patch / minor / major) from the latest published release on origin,
  tags the `develop-v2` tip `vX.Y.Z`, pushes the tag to origin, then opens a
  draft GitHub release whose notes summarise the changes since the previous
  release. Use when the user asks to cut or publish a release, bump the version
  and release, tag a release, or ship develop-v2 to production.
---

# Publish a release

Ship Plumber to production by publishing a GitHub release from a version tag.

**Release model (fixed for this repo):**

- Releases ship from `develop-v2` (the trunk). There is no release PR. Nothing
  merges into `production`.
- The latest published release tag on origin is the version source of truth.
  The next version is that tag plus the chosen bump.
- `package.json` versions are not bumped. There is no release commit. The
  deploy resolves the version from the tag with `git describe` and passes it to
  the backend and frontend as `APP_VERSION`.
- The `develop-v2` tip is tagged `vX.Y.Z`. Only the tag is pushed to origin.
- The GitHub release is created from that tag as a **draft**. The human
  publishes it.
- Publishing fires `release: [released]`, which runs
  [.github/workflows/deploy-production.yml](../../../.github/workflows/deploy-production.yml).
  **Publishing is the production deploy.**

## Hard rules (non-negotiable)

1. **Never publish the release.** You create the draft. The human clicks
   Publish, because that deploys to production. Never run `gh release create`
   without `--draft`. Never run `gh release edit --draft=false`.
2. **Push only the `vX.Y.Z` tag.** Never push a branch. Never force-push.
3. **Never edit `package.json` for a release.** Never create a release commit.
   The tag alone sets the version.
4. **Never tag before step 1 passes.** A release must be cut from a clean,
   fully-synced `develop-v2`.

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
gh release list --limit 100 --json tagName,isDraft --jq '.[] | select(.isDraft) | .tagName'
```

Abort and tell the user if: not on `develop-v2`, the tree is dirty, or local and
`origin/develop-v2` diverge.

The last command lists draft releases. `scheduled-release.yml` creates drafts on
its own. If one exists, tell the user and ask whether to publish that draft
instead of cutting a new release.

### 2. Summarise the changes since the previous release

The previous release is the latest published release on origin. Drafts and
pre-releases do not count:

```bash
PREV=$(gh api "repos/{owner}/{repo}/releases/latest" --jq .tag_name) && echo "since $PREV" && git log --oneline --no-merges "$PREV"..HEAD
```

This is the set of changes the release ships. Condense each commit into one
release-note bullet. Keep the conventional-commit type prefix and the `(#PR)`
number, e.g. `- chore: enable Datadog continuous profiling (#1805)`.
**Exclude** old version-bump commits (messages matching `vX.Y.Z`).

If the list is empty or surprisingly small, surface that to the user before
continuing. It may mean other branches still need to merge into `develop-v2`.

### 3. Prompt for the bump type

Take the step-2 tag `vX.Y.Z` and compute what each bump resolves to. Then use
the **AskUserQuestion** tool to ask which bump to apply, with three options.
Show the resulting version in each:

- **patch** (`X.Y.(Z+1)`) for bug fixes and chores only.
- **minor** (`X.(Y+1).0`) for new features, backwards-compatible.
- **major** (`(X+1).0.0`) for breaking changes.

Recommend a default by scanning the step-2 commits. Any breaking change
recommends major. Any `feat` recommends minor. Otherwise patch. Put the
recommended option first and append " (Recommended)" to its label.

### 4. Tag

Replace `<bump>` with the chosen `patch`/`minor`/`major`:

```bash
PREV=$(gh api "repos/{owner}/{repo}/releases/latest" --jq .tag_name)
[[ "$PREV" =~ ^v([0-9]+)\.([0-9]+)\.([0-9]+)$ ]] || { echo "latest release tag '$PREV' is not vX.Y.Z"; exit 1; }
MAJOR=${BASH_REMATCH[1]} MINOR=${BASH_REMATCH[2]} PATCH=${BASH_REMATCH[3]}
case <bump> in
  major) NEW="v$((MAJOR + 1)).0.0" ;;
  minor) NEW="v$MAJOR.$((MINOR + 1)).0" ;;
  patch) NEW="v$MAJOR.$MINOR.$((PATCH + 1))" ;;
esac
git rev-parse -q --verify "refs/tags/$NEW" && { echo "$NEW already exists"; exit 1; }
git tag "$NEW" && echo "tagged $NEW"
```

The script recomputes `PREV` instead of reusing step 2. It aborts if the new tag
already exists locally.

### 5. Verify

```bash
git tag --points-at HEAD                  # expect: vX.Y.Z
git describe --tags --match 'v[0-9]*.[0-9]*.[0-9]*'   # expect: vX.Y.Z
git status --porcelain                    # expect: empty
```

`git describe` must print exactly `vX.Y.Z`. The deploy runs the same command to
set the version the app reports.

If anything is off (wrong version, stray tag), delete the tag and retry:

```bash
git tag -d vX.Y.Z
```

### 6. Push the tag

```bash
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

A pre-release does not count as the latest published release. The next release
computes its version from the last full release, so it can reuse the
pre-release's version. Promote or delete the pre-release before cutting another.

## Gotcha: do not read the version from `package.json`

`package.json` versions are no longer bumped and lag behind the tags. Any version
computed from them can collide with an existing release.

## Gotcha: workflow-created releases do not deploy

A release created by a workflow using the default `GITHUB_TOKEN` fires no
`release` event. Create releases with your own `gh` credentials or a GitHub App
token.
