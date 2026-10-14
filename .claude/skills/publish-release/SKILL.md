---
name: publish-release
description: >
  Publish a Plumber production release. Prompts the user to choose the version
  bump (patch / minor / major), bumps the version across the root workspace and
  the app packages, creates a single conventional `vX.Y.Z` commit
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
  bumps the root `package.json` and the four app packages (`backend`,
  `frontend`, `backend-archive`, `types`) to that same version. `tools/*`
  stay on their own versions. `pnpm-lock.yaml` does not store the app
  version, so it is not part of this commit.
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
3. **One clean bump commit.** The commit must touch exactly these five files:
   the root `package.json`, `packages/backend/package.json`,
   `packages/frontend/package.json`, `packages/backend-archive/package.json`,
   and `packages/types/package.json`. Its message is `vX.Y.Z` (with the `v`
   prefix). Each file's version field must be that same version. Do not leave
   a workspace bump uncommitted. See the gotcha below.
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

Replace only the `version` field in the five app manifests. **You** create the
commit and tag. Do not use `npm version` or `pnpm version` (see gotcha).
Replace `<bump>` with the chosen `patch`/`minor`/`major`:

```bash
nvm use
NEW=$(BUMP=<bump> node << 'EOF'
const fs = require('fs')
const files = [
  'package.json',
  'packages/backend/package.json',
  'packages/frontend/package.json',
  'packages/backend-archive/package.json',
  'packages/types/package.json',
]
const bump = process.env.BUMP
function nextVersion(version, kind) {
  const [major, minor, patch] = version.split('.').map(Number)
  if (kind === 'major') return `${major + 1}.0.0`
  if (kind === 'minor') return `${major}.${minor + 1}.0`
  if (kind === 'patch') return `${major}.${minor}.${patch + 1}`
  throw new Error(`unknown bump ${kind}`)
}
const current = JSON.parse(fs.readFileSync('package.json', 'utf8')).version
const next = nextVersion(current, bump)
const pattern = new RegExp(`("version"\\s*:\\s*")${current.replaceAll('.', '\\.')}(")`)
for (const file of files) {
  const pkg = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (pkg.version !== current) {
    throw new Error(`${file} is ${pkg.version}, expected ${current}`)
  }
  const text = fs.readFileSync(file, 'utf8')
  const updated = text.replace(pattern, `$1${next}$2`)
  if (updated === text) throw new Error(`version field not found in ${file}`)
  fs.writeFileSync(file, updated)
}
process.stdout.write(next)
EOF
)
git add package.json packages/backend/package.json packages/frontend/package.json packages/backend-archive/package.json packages/types/package.json
git commit -m "v$NEW"
git tag "v$NEW"
```

The server reads `packages/backend/package.json` at startup. If that file stays
on the old version, production still reports the old version. The script aborts
when any of the five files has already drifted from the root version.

### 5. Verify

```bash
git show --stat HEAD
git tag --points-at HEAD    # expect: vX.Y.Z
git status --porcelain      # expect: empty
node -p "
const files = ['package.json','packages/backend/package.json','packages/frontend/package.json','packages/backend-archive/package.json','packages/types/package.json']
files.map(f => require('./'+f).version).join(' ')
"
```

`git show --stat` must list only those five `package.json` files, and the
message must be `vX.Y.Z`. The `node -p` line must print the new version five
times. `tools/*/package.json` and `pnpm-lock.yaml` must be absent from the
commit.

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

## Gotcha: do not use `npm version` or `pnpm version`

`npm version` is rejected by the `preinstall` allow-list, and it writes
`package-lock.json`, which this repo no longer has. With its default git
tagging it also commits only the root `package.json`, so the workspace
versions never land on the tag.

`pnpm version patch` bumps only the root. The running server would keep
reporting the old version from `packages/backend/package.json`.

`pnpm version patch -r` bumps `tools/*` as well (those stay on `1.0.0`) and
rewrites each `package.json`, which can reorder dependency keys. The release
commit would then contain more than the version field.

Step 4 replaces the `version` string in the five app manifests and commits
those files by hand. The diff is the version field only, and the tag contains
the version the server actually reads.

## Gotcha: workflow-created releases do not deploy

A release created by a workflow using the default `GITHUB_TOKEN` fires no
`release` event. Create releases with your own `gh` credentials or a GitHub App
token.
