---
name: langfuse-prompts
description: >
  Help a developer edit, test and push an AI Builder Langfuse prompt from a
  local working copy. Use when asked to change, improve or test the AI Builder
  system prompt (chat, chat-summary), pull or push a Langfuse prompt, or
  resolve a prompt merge.
---

# Langfuse prompts

The workflow and commands live in [tools/langfuse/PROMPTS.md](../../../tools/langfuse/PROMPTS.md). Read it first.

## Rules

- **Never commit prompt text.** Working copies live in `tools/langfuse/prompts/`, which git ignores. Never paste prompt text into a commit, PR or tracked file.
- **Commands that reach Langfuse need 1Password.** `pull`, `status`, `diff --against=<label>` and `push` run as `pnpm run prompt ...` and prompt for biometrics. If this session cannot answer that prompt, give the developer the exact command and wait.
- **Never promote.** Promotion to `production` happens in the Langfuse UI only.
- **Draft, do not decide.** Propose each prompt edit with the reason. The developer confirms before you write it.

## Steps

1. **Find the working copy.** Look for `tools/langfuse/prompts/<project>/<name>.md`. If it is missing, ask the developer to run `pnpm run prompt pull <name>` and stop until it exists.
2. **Check the base.** Ask the developer to run `pnpm run prompt status`. If the base label moved, ask for `pnpm run prompt pull <name> --merge` before editing.
3. **Edit.** Read the working copy. Propose targeted edits. Write them to the working copy only. Never edit `.base.md` or `.meta.json`.
4. **Test.** The local backend reads the working copy on every request. Ask the developer to try the change in the local AI Builder and report what happened.
5. **Review.** Run `git diff --no-index tools/langfuse/prompts/<project>/<name>.base.md tools/langfuse/prompts/<project>/<name>.md` to show the full change. It needs no credentials.
6. **Resolve conflicts.** After a merge, find `<<<<<<<` markers in the working copy. Propose a resolution per conflict. Push refuses while markers remain.
7. **Push.** Give the developer `pnpm run prompt push <name> -m "<message>"` with a message that states what changed and why. Report the version and `dev-<name>` label it prints.
