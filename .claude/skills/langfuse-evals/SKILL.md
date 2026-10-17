---
name: langfuse-evals
description: >
  Maintain and run the AI Builder prompt evals in Langfuse. Use when a new
  app, action, agent tool or prompt rule needs eval coverage, when a Prompt
  Experiment finished and someone asks whether the new prompt version is
  working, or when eval failures need triage into judge miss, gold error,
  flake or regression. Wraps tools/langfuse/eval-dataset.mjs and follows
  tools/langfuse/README.md.
---

# Langfuse evals

Two jobs: keep the gold dataset in Langfuse current, and judge whether a new prompt version passes it. The process lives in [tools/langfuse/README.md](../../../tools/langfuse/README.md). Read it before the first run in a session. The production dataset is `ai-builder/chat-20261012`. Its local working copy is `tools/langfuse/datasets/ai-builder/chat-20261012/items.json`, ignored by git. The committed notes are in `tools/langfuse/notes/ai-builder/chat-20261012/`. Pass `--dataset=<name>` and the commands find both.

Hard rules:

- **Langfuse holds the dataset. Never commit items.** `pull` before editing, edit the local `items.json`, `push` after. Only `notes/<dataset>/` is committed.
- **Gold follows the prompt, not the model.** A failing run is never by itself a reason to change gold. Each gold edit needs a line in `notes/<dataset>/CHANGELOG.md` with the reason and a trace id.
- **Never drop `must_not_tools`.** Never remove a side-effect guard to make a row pass.
- **Never push with `--archive-missing`, and never `improve --push`, without the user confirming the list first.**
- **Commands that reach Langfuse need 1Password.** Run them as `pnpm run eval-dataset ...` from `tools/langfuse`. If the credential prompt cannot be answered in this session, hand the exact command to the user and continue with the offline steps.
- **Never copy an item into the prompt as an example.**

## Workflow A: add coverage for a new app, action, tool or prompt rule

1. Find what changed. For a tool, read its entry in `packages/backend/src/helpers/mcp-bridge-tools.ts`. For an app or action, read its definition under `packages/backend/src/apps/<key>/`. For a prompt rule, read the new prompt version (`pnpm run get-prompt chat --label=latest`) and diff it against the saved production version in `docs/plans/prompts/`.
2. List the behaviours the change promises. Each becomes at least one item.
3. Run `node eval-dataset.mjs coverage --items=datasets/<name>/items.json`. Note the gaps for the affected tools and apps.
4. Write items following [references/item-schema.md](references/item-schema.md). Minimum per new tool: one should-fire, one must-not-fire, and for `execute_step`, `register_connection`, `delete_step` or `unpublish_pipe` one clarify item. Minimum per new prompt rule: one item that obeys it and one that would be tempted to break it.
5. Write realistic inputs. Reuse the message shapes in existing items. Replace personal data with placeholders such as `<EMAIL_1>`.
6. Set `suite` to `capability` for new items. Add `covers` tags: `tool:`, `app:`, `decision:`, `failure:`.
7. Run `validate`, then `coverage` again. Append a line to `notes/<dataset>/CHANGELOG.md`.
8. Show the user the new items and the push command. Push only when they agree. The items are not committed. The push is how they persist.

## Workflow B: evaluate an experiment run

1. Ask for, or find, the dataset name, the candidate run name and the baseline run name. The baseline is the latest run on the production prompt version. If a baseline report is missing, `read` it too.
2. Run:
   ```bash
   pnpm run eval-dataset read --dataset=<name> --run=<candidate run>
   node eval-dataset.mjs compare --baseline=out/<name>/<baseline>.json --candidate=out/<name>/<candidate>.json
   ```
3. Triage every `broken` row and every `both fail` row in `suite: regression` using [references/triage.md](references/triage.md). Open the trace in Langfuse when the judge comment is not enough. Run `improve --report=...` to find the two safe gold edits and the judge misses. Treat its `skip` rows as manual work.
4. Report in this order: verdict, `must_not_tools` violations, broken rows with their bucket, fixed rows, slice table for slices with 20 or more items, flaky rows if two runs exist. Counts, not percentages, for small slices.
5. Recommend one of: ship, fix the prompt (name the rows and the rule to change), fix the judge, or fix gold (name the rows and the reason). The user decides.

## Workflow C: build or seed a dataset

Follow Part A of the README. The agent runs `pull` or `init --stubs`, `sample`, `adopt`, `validate`, `coverage` and `push`. The human does error analysis, writes gold and labels rows for judge calibration. Do not write `expected_output` for a sampled trace from `metadata.observed` alone. Present the candidate and ask the human what the correct decision is. Do not fill `human` in `judge-labels.json`. That column is the human's.

## Workflow D: check the judge

After a judge prompt or model change, or when a triage finds two or more `judge_miss` rows in one run:

```bash
node eval-dataset.mjs calibrate --report=out/<safe name>/<run>.json --dataset=<name>
```

Report both rates and the disagreements. Below 90% on either rate, propose a judge prompt change and name the rows that motivated it. If `notes/<dataset>/judge-labels.json` does not exist, write the template with `--write-template` and hand it to the user.

## Output

The deliverable for Workflow A is the pushed items in Langfuse plus the diff to `notes/<dataset>/CHANGELOG.md`. The deliverable for Workflow B is the written report in chat with the run names and trace ids. Do not change the prompt in Langfuse from this skill.
