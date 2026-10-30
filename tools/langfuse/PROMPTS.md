# Prompts

AI Builder prompt text lives in the private [plumber-prompts](https://github.com/opengovsg/plumber-prompts) repo. That repo is the source of truth. Langfuse serves the versions the backend reads in deployed environments.

## Setup

Run `pnpm run prompts:clone` from the repo root. It clones the prompts repo into `tools/langfuse/prompts/`. Plumber's git ignores that folder.

Run it again to fetch. It fast-forwards only when you are on the default branch with no changes.

Set `PLUMBER_PROMPTS_REPO` to clone from another URL, such as an SSH remote.

## How the backend picks a prompt

In local dev (`APP_ENV=development`), the backend reads `tools/langfuse/prompts/<project>/<name>.md` on every request. Edits apply without a restart. The prompt name comes from the `ai-builder` LaunchDarkly flag (`chat` or `chat-summary`).

- No local file: the backend logs a warning and fetches from Langfuse.
- `AI_BUILDER_PROMPT_SOURCE=langfuse`: the backend ignores local files and fetches from Langfuse.
- Deployed environments never read local files.

Traces from a local prompt carry `promptSource: local` and are not linked to a Langfuse prompt version.

## Commands

Run from the repo root. `prompt` commands reach Langfuse through 1Password, so they prompt for biometrics.

| Command                                      | What it does                                                                                             |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `pnpm run prompts:clone`                     | Clones or fetches the prompts repo. Needs no Langfuse credentials.                                       |
| `pnpm run prompt status`                     | Shows each prompt's uncommitted changes, and whether `production` serves the text on `main`.             |
| `pnpm run prompt push <name> -m "<message>"` | Creates a new Langfuse version from the committed file. Labels it `dev-<your git email name>`.           |
| `pnpm run prompt pull <name>`                | Writes a Langfuse label's text into the prompts repo. Use `--label=<label>` to pick a label.             |
| `pnpm run prompt import`                     | Writes every prompt that has the `production` label into the prompts repo. Used for the first migration. |

Add `--project=pairAction` to use the other Langfuse project. The default is `aiBuilder`.

`pull` and `import` refuse to overwrite files with uncommitted changes. Pass `--force` to discard them.

## Pushing safely

Every pushed version must contain everything already on `main`. This stops a promotion from reverting another dev's merged change.

- `push` refuses uncommitted files. The Langfuse commit message records the prompts repo commit.
- `push` refuses when your branch does not contain `origin/main`. Merge or rebase first.
- `push` copies config and tags from the `production` version. It never sets `production`.
- Langfuse moves `latest` to every new version. The `Latest` variation of the `ai-builder` flag serves it. Production never uses `latest`.
- Promote a version to `production` in the Langfuse UI only. Promote it only after its commit merges into `main`.
- Never edit prompt text in the Langfuse UI. `status` reports when `production` differs from `main`.

## Typical loop

1. `pnpm run prompts:clone`. Create a branch in `tools/langfuse/prompts/`.
2. Edit `tools/langfuse/prompts/aiBuilder/chat.md`. Test it in the local AI Builder.
3. Commit the change in the prompts repo.
4. `pnpm run prompt push chat -m "<what changed and why>"`. Evaluate the new version.
5. Open a PR in the prompts repo. After it merges, promote the version in the Langfuse UI.

## One-time migration

1. `pnpm run prompts:clone`
2. `pnpm run prompt import`
3. `pnpm run prompt import --project=pairAction`
4. Review the files with `git status`. Commit and push them to `main` in the prompts repo.
5. `pnpm run prompt status` should report that every prompt matches `origin/main`.
