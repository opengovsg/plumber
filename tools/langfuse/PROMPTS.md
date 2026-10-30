# Prompts

The private [plumber-prompts](https://github.com/opengovsg/plumber-prompts) repo mirrors the prompts in Langfuse. Each prompt has a folder. Each Langfuse version is one file. The repo and Langfuse always hold the same version numbers.

```
aiBuilder/                  # Langfuse project
  chat/
    v1.md … v211.md         # text prompt versions, read-only after push
    v211.meta.json          # { "config": {...}, "commitMessage": "..." }
  chat-eval-harness/
    v17.json                # chat prompt versions hold the message list
    v17.meta.json
  skills/                   # Langfuse folder
    <prompt>/v1.md …
pairAction/
```

Labels and tags are not stored. They change in the Langfuse UI after a version is created.

## Setup

Run every command from the plumber repo root.

1. `pnpm run prompts:clone` clones plumber-prompts into `tools/langfuse/prompts/`. Plumber's git ignores that folder.
2. Run it again to fetch. It fast-forwards only on a clean default branch.

Set `PLUMBER_PROMPTS_REPO` to clone from another URL, such as an SSH remote.

## How the backend picks a prompt

In local dev (`APP_ENV=development`), the backend serves the highest-numbered `vN.md` in `tools/langfuse/prompts/<project>/<name>/`. That is your draft while you edit one. Edits apply without a restart.

- No version files: the backend logs a warning and fetches from Langfuse.
- `AI_BUILDER_PROMPT_SOURCE=langfuse`: the backend ignores local files.
- Deployed environments never read local files. The `ai-builder` LaunchDarkly flag selects the Langfuse version.

## Commands

`prompt` commands reach Langfuse through 1Password, so they prompt for biometrics.

| Command                                      | What it does                                                                               |
| -------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `pnpm run prompts:clone`                     | Clones or fetches plumber-prompts.                                                         |
| `pnpm run prompt new <name>`                 | Copies the newest version to the next number as your draft.                                |
| `pnpm run prompt diff <name>`                | Diffs the newest version against the one before it.                                        |
| `pnpm run prompt push <name> -m "<message>"` | Pushes the draft to plumber-prompts `main`, then creates the same version in Langfuse.     |
| `pnpm run prompt status`                     | Lists versions missing from `main` or from Langfuse.                                       |
| `pnpm run prompt sync`                       | Writes every Langfuse version missing from the repo. Commit and push the files afterwards. |

`new`, `diff` and `push` default to `--project=aiBuilder`. `status` and `sync` cover both projects unless you pass `--project`. `new` and `push` support text prompts only.

## Typical loop

1. `pnpm run prompts:clone`
2. `pnpm run prompt new chat`
3. Edit `tools/langfuse/prompts/aiBuilder/chat/v<N>.md`. Test it in the local AI Builder.
4. `pnpm run prompt diff chat`
5. `pnpm run prompt push chat -m "<what changed and why>"`
6. Promote the version in the Langfuse UI or the LaunchDarkly flag.

## How push keeps versions in sync

- It refuses unless the draft is the next number after the newest version on `main` and in Langfuse.
- It refuses when a pushed version file has changes. Pushed versions are read-only.
- It pushes to git before it creates the Langfuse version. Git rejects a push that is not on top of `main`, so a concurrent push stops before it reaches Langfuse.
- If someone pushed the same number first, `push` asks for `--renumber`. That renumbers your draft and stops. Run `diff`, fold their change into your draft, test, then push again.
- If Langfuse fails after the git push, run `push` again. It creates the missing version from the repo.

## Rules

- Create versions with `push`. If someone creates one in the Langfuse UI, run `pnpm run prompt sync` and commit the files. A local draft with the same number moves to the next number.
- Never edit a pushed version file.
- Never commit prompt text to plumber. Plumber is public.

## Initial sync

1. `pnpm run prompts:clone`
2. `pnpm run prompt sync`
3. In `tools/langfuse/prompts/`, commit the files as `Initial sync from Langfuse` and push to `main`.
4. `pnpm run prompt status` should report that every prompt is in sync.
