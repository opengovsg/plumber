# Local prompts

Edit and test AI Builder prompts locally, then push a new version to Langfuse.

## How the backend picks a prompt

In local dev (`APP_ENV=development`), the backend reads `tools/langfuse/prompts/<project>/<name>.md` on every request. Edits apply without a restart. The prompt name comes from the `ai-builder` LaunchDarkly flag (`chat` or `chat-summary`).

- No local file: the backend logs a warning with the pull command and fetches from Langfuse.
- `AI_BUILDER_PROMPT_SOURCE=langfuse`: the backend ignores local files and fetches from Langfuse.
- Deployed environments never read local files.

Traces from a local prompt carry `promptSource: local` and are not linked to a Langfuse prompt version.

## Commands

Run from the repo root. Commands that reach Langfuse go through 1Password, so they prompt for biometrics.

| Command                                           | What it does                                                                                         |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `pnpm run prompt pull <name>`                     | Saves the `production` version to the working copy. Refuses to overwrite local edits.                |
| `pnpm run prompt pull <name> --label=<label>`     | Uses another label as the base. Push then checks against that label.                                 |
| `pnpm run prompt pull <name> --merge`             | Three-way merges the label's current version into your edits. Conflicts appear as `<<<<<<<` markers. |
| `pnpm run prompt pull <name> --force`             | Discards local edits and pulls again.                                                                |
| `pnpm run prompt status`                          | Shows each local prompt, whether it is edited, and whether its base label moved.                     |
| `pnpm run prompt diff <name> [--against=<label>]` | Diffs your copy against the version you pulled, or against a label's current version.                |
| `pnpm run prompt push <name> -m "<message>"`      | Creates a new Langfuse version labelled `dev-<your git email name>`.                                 |

Add `--project=pairAction` to use the other Langfuse project. The default is `aiBuilder`.

## Files

`prompts/` is ignored by git. Never commit prompt text.

| File                               | Purpose                                          |
| ---------------------------------- | ------------------------------------------------ |
| `prompts/aiBuilder/chat.md`        | The working copy. Edit this one.                 |
| `prompts/aiBuilder/chat.base.md`   | The version you pulled. Used for diff and merge. |
| `prompts/aiBuilder/chat.meta.json` | Base label, base version, config and tags.       |

## Pushing safely

Every pushed version must contain everything its base label currently serves. This stops a promotion from reverting another dev's promoted change.

- `push` refuses when the base label moved since you pulled. Run `pull --merge`, check the result, then push again.
- Langfuse has no conditional create. If the base label moves during the push, `push` prints a warning.
- `push` copies config and tags from the base version and sets your `dev-<name>` label. It never sets `production`.
- Langfuse moves `latest` to every new version. The `Latest` variation of the `ai-builder` flag serves it. Production never uses `latest`.
- Promote a version to `production` in the Langfuse UI only.

## Typical loop

1. `pnpm run prompt pull chat`
2. Edit `tools/langfuse/prompts/aiBuilder/chat.md`. Test it in the local AI Builder.
3. `pnpm run prompt status`. Merge if the base label moved.
4. `pnpm run prompt push chat -m "<what changed and why>"`
5. Evaluate the new version, then promote it in the Langfuse UI.
