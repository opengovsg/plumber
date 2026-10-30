---
name: langfuse-prompts
description: >
  Help a developer edit, test and push an AI Builder prompt from the
  plumber-prompts repo to Langfuse. Use when asked to change, improve or test
  the AI Builder system prompt (chat, chat-summary), push a prompt to
  Langfuse, or migrate prompts from Langfuse into the prompts repo.
---

# Langfuse prompts

The workflow and commands live in [tools/langfuse/PROMPTS.md](../../../tools/langfuse/PROMPTS.md). Read it first.

## Rules

- **Never commit prompt text to plumber.** Prompt text lives in the private prompts repo at `tools/langfuse/prompts/`. Never paste prompt text into a plumber commit, PR or tracked file.
- **Commands that reach Langfuse need 1Password.** `pnpm run prompt ...` prompts for biometrics. If this session cannot answer that prompt, give the developer the exact command and wait. `pnpm run prompts:clone` needs no 1Password.
- **Never promote.** Promotion to `production` happens in the Langfuse UI only.
- **Draft, do not decide.** Propose each prompt edit with the reason. The developer confirms before you write it.

## Steps

1. **Find the prompts repo.** Check that `tools/langfuse/prompts/` is a git repo. If not, run `pnpm run prompts:clone`.
2. **Branch.** In `tools/langfuse/prompts/`, create a branch from an up-to-date `origin/main`.
3. **Edit.** Read `tools/langfuse/prompts/<project>/<name>.md`. Propose targeted edits. Write them after the developer confirms.
4. **Test.** The local backend reads the file on every request. Ask the developer to try the change in the local AI Builder and report what happened.
5. **Commit.** Show `git -C tools/langfuse/prompts diff`, then commit in the prompts repo with a message that states what changed and why.
6. **Push.** Give the developer `pnpm run prompt push <name> -m "<message>"`. Report the version and `dev-<name>` label it prints.
7. **Merge.** Remind the developer to open a PR in the prompts repo and promote the version only after it merges.
