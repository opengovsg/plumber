---
name: langfuse-prompts
description: >
  Help a developer improve an AI Builder Langfuse prompt. Drafts a new version
  in the plumber-prompts repo, tests it locally and pushes it to Langfuse.
  Use when asked to change, improve or test the AI Builder system prompt (chat,
  chat-summary), push a prompt to Langfuse, or sync prompts from Langfuse.
---

# Langfuse prompts

The workflow and commands live in [tools/langfuse/PROMPTS.md](../../../tools/langfuse/PROMPTS.md). Read it first.

## Rules

- Run every command from the plumber repo root.
- `pnpm run prompt` commands need 1Password biometrics. If you cannot run one, give the developer the exact command and wait.
- Edit only the draft, which is the newest `vN.md`. Never edit older version files.
- Push only when the developer asks.
- Never promote a version or change the LaunchDarkly flag.
- Never copy prompt text into plumber files, commits or PRs. Plumber is public.

## Steps

1. **Set up.** Run `pnpm run prompts:clone`, then `pnpm run prompt new <name>`. The draft is `tools/langfuse/prompts/<project>/<name>/v<N>.md`.
2. **Understand the problem.** Ask what behaviour to change. Ask for an example conversation that shows it.
3. **Edit.** Read the draft. Propose small, targeted edits, each with its reason. Write an edit only after the developer agrees.
4. **Test.** The local backend serves the draft on every request. Ask the developer to test it in the local AI Builder and report what happened. Repeat steps 3 and 4 until the developer is satisfied.
5. **Review.** Run `pnpm run prompt diff <name>`. It compares the draft with Langfuse's newest version. Summarise the change.
6. **Push.** Give the developer `pnpm run prompt push <name> -m "<what changed and why>"`.
7. **Handle a rejected push.** If push asks for `--renumber`, give the developer `pnpm run prompt push <name> --renumber`. Then reconcile, below.
8. **Finish a half-done push.** If push says Langfuse did not create the version, give the developer `pnpm run prompt push <name> --resume`.

## Reconcile a renumbered draft

`push --renumber` and `sync` move a draft when another version took its number. They merge that version into the draft and stop. Whenever one of them reports a move, offer this help without being asked.

1. **Explain what landed.** Read the draft's `meta.json` for `basedOn`. Diff `v<basedOn>.md` against the version that landed first. Summarise what the other developer changed and why, using its `meta.json` commit message.
2. **Clean merge.** Show the merged draft's changes against the version that landed first. Confirm both developers' intents survive.
3. **Conflicts.** For each `<<<<<<<` block, show both sides. Propose a resolution that keeps both intents, with the reason. Write it only after the developer agrees.
4. **Check for leftovers.** Search the draft for `<<<<<<<`, `=======` and `>>>>>>>`. `push` refuses while any remain.
5. **Re-test.** Ask the developer to test the merged draft in the local AI Builder before pushing.
