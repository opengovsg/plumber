---
name: langfuse-evals
description: >
  Guide a developer step by step through the AI Builder prompt evals in
  Langfuse: import the dataset, derive the behaviour inventory from the
  production prompt, write items to close coverage gaps, run the baseline,
  triage failures until the gold is trustworthy, calibrate the judge, then
  compare new prompt versions against the baseline. Use when asked to build
  or improve the eval dataset, add coverage for a new app, action, tool or
  prompt rule, judge whether a prompt experiment passed, or triage eval
  failures. Wraps tools/langfuse/eval-dataset.mjs.
---

# Langfuse evals

You drive a multi-session process. The developer runs the commands that need
1Password and makes the judgement calls. You prepare, draft, check and report.
Command reference and flags: [tools/langfuse/README.md](../../../tools/langfuse/README.md).

## Hard rules

- **Langfuse holds the dataset. Never commit items, notes or prompts.** `tools/langfuse/datasets/`, `tools/langfuse/notes/` and `docs/plans/prompts/` are ignored by git. Never move their contents elsewhere in the repo and never paste prompt text into a commit, PR or file outside those folders.
- **Gold follows the prompt, not the model.** A failing run is never by itself a reason to change gold. Every gold edit gets a line in `notes/<dataset>/CHANGELOG.md` with the reason and a trace id.
- **Never drop `must_not_tools`** to make a row pass. Never remove a side-effect guard.
- **Confirm before anything that reaches Langfuse or changes gold.** Show the diff or the list, then wait. `push --archive-missing` and `improve --push` need an explicit yes to the exact list.
- **Commands that reach Langfuse need 1Password.** They run as `pnpm run eval-dataset ...` from `tools/langfuse`. If the credential prompt cannot be answered in this session, give the developer the exact command and continue with offline steps.
- **Never copy an item into the prompt as an example.**
- **Draft, do not decide.** For every item you write, the developer confirms the expected output. Say which prompt rule it pins.

## Start here: pick the dataset, then find the phase

**Never assume the dataset.** Ask the developer which Langfuse dataset the session is about. To help them answer, list what exists:

```bash
cd tools/langfuse
ls -d datasets/*/*/items.json datasets/*/items.json 2>/dev/null   # local copies, offline
pnpm run eval-dataset datasets                                     # every dataset in Langfuse, needs 1Password
```

One local copy and no other answer means that dataset. Several, or none, means ask. A new dataset starts with `init --dataset=<name>` and must also be created in Langfuse before the first push. Use the chosen name as `<dataset>` in every command below. A `/` in the name becomes a directory locally, and `_` in the `out/` report folder.

Then run these (offline) and read the answers:

```bash
ls datasets/<dataset>/items.json notes/<dataset>/ out/<dataset with / as _>/ 2>&1
ls ../../docs/plans/prompts/ 2>&1
```

| Found | Phase |
| --- | --- |
| No `items.json` | 1. Import |
| `items.json` but no `CHANGELOG.md` with a filled "Behaviour inventory" | 2. Inventory |
| Inventory exists, `coverage` lists gaps or inventory lines have no item | 3. Write items |
| No report in `out/` | 4. Baseline |
| Baseline report exists, no `judge-labels.json` with `human` filled | 5. Calibrate |
| Baseline stable and judge calibrated | 6. Evaluate a new prompt, or 7. Maintain |

Tell the developer which dataset and phase you are in and what the phase produces before running anything.

## Phase 1: Import

1. Ask the developer to run `pnpm run eval-dataset pull --dataset=<dataset>` (add `--force` if a local copy exists). It also creates the notes folder.
2. Run `node eval-dataset.mjs inspect --dataset=...` and read the shape: input keys, decision counts, `suite` values, judge instruction keys. Learn the dataset's own vocabulary from this. Match it in everything you write.
3. Run `node eval-dataset.mjs validate --dataset=... --fix`. `--fix` only removes forbidden tools the agent does not have. Report every other error with the fix you propose. Do not edit `items.json` until the developer agrees.
4. Run `coverage`. Keep the gap list for Phase 3.

Done when `validate` passes.

## Phase 2: Behaviour inventory

1. Ask which Langfuse prompt the dataset tests (`chat` for the AI Builder) and have the developer run `pnpm run get-prompt <prompt> --label=production`. Read the saved file under `docs/plans/prompts/`. Never quote it in a commit.
2. Write `notes/<dataset>/CHANGELOG.md` with three sections: **Behaviour inventory**, **Failure taxonomy**, **Changes**. Follow [references/inventory.md](references/inventory.md) for the shape of a rule line and what counts as testable.
3. Group rules by prompt phase. Give each a stable id `R01`, `R02`, ... Each line names one behaviour the judge could check from one turn: the tool to call, the block to emit, the question to ask, or the thing never to do.
4. Walk the developer through the list. They strike rules that are not worth an item and add rules you missed. Record the prompt version at the top.

Done when the developer confirms the inventory. It is local only.

## Phase 3: Write items

1. Build the worklist: every `coverage` gap, then every inventory line with no item tagged `rule:<id>`. Order: side-effect tools first, then tools with zero items, then rules.
2. Optional: ask for `pnpm run eval-dataset sample --from=<iso> --limit=150` to seed from production. Pick candidates across strata, prefer traces with errors or long turns. `adopt` copies one into `items.json` as a draft. Present `metadata.observed_decision` as evidence and ask the developer what the prompt requires. Never set the gold from the observed decision alone.
3. Draft items following [references/writing-items.md](references/writing-items.md) and [references/item-schema.md](references/item-schema.md). Per tool: one should-fire, one must-not-fire, and for `execute_step`, `register_connection`, `delete_step`, `unpublish_pipe` one confirm-first. Per rule: one item that obeys it and one that would be tempted to break it. New items get `stage: capability`.
4. Show the developer each batch of up to six items as JSON with the rule each pins. Apply only what they approve. Run `validate` and `coverage` after each batch.
5. Ask for `pnpm run eval-dataset push --dataset=...`. Add one line per batch to the **Changes** section.

Done when `coverage` reports no gaps and every inventory line kept in Phase 2 has an item.

## Phase 4: Baseline until the gold is trustworthy

The gold is trustworthy when two consecutive runs of the production prompt produce no `gold_error` and no `judge_miss` on triage, and every `stage: regression` item passes on both.

1. Ask the developer to run the experiment twice in the Langfuse UI per [references/langfuse-ui.md](references/langfuse-ui.md), named `chat-v<N>-<yyyymmdd>-a` and `-b`.
2. Ask for `pnpm run eval-dataset read --dataset=... --run=<name>` for each run.
3. Run `node eval-dataset.mjs compare --baseline=out/.../<a>.json --candidate=out/.../<b>.json`. Rows that flip between the two are `flaky`.
4. Run `node eval-dataset.mjs improve --report=out/.../<a>.json`. It marks `judge_miss` rows and proposes the two safe gold edits. Triage every other failure with [references/triage.md](references/triage.md). Open traces in Langfuse when the comment is not enough.
5. Propose gold edits as a list with reasons. After approval: `improve --apply --dataset=...` for the safe ones, hand edits for the rest, `validate`, `push`, changelog lines.
6. Items that fail on the production prompt with correct gold are real misses. Move them to `stage: capability` with a changelog line. They stay in the dataset and become the first targets for the next prompt version.
7. Promote items that passed on both runs to `stage: regression`.
8. Repeat from step 1 until the criterion holds. Record both run names in the changelog under a **Baseline** heading. Those reports are the baseline for Phase 6.

## Phase 5: Calibrate the judge

1. Run `node eval-dataset.mjs calibrate --report=out/.../<baseline a>.json --dataset=... --write-template`. It writes `notes/<dataset>/judge-labels.json` with up to 50 judge-pass and 50 judge-fail rows.
2. The developer labels `human` on each row from the trace and the gold without reading the `judge` column. You never fill `human`.
3. Run `calibrate --report=... --dataset=...`. Both rates must reach 90%. Below that, list the disagreements and propose judge prompt changes. The developer edits the evaluator in Langfuse and re-runs it on the same run. Repeat.
4. Note the judge model and prompt version in the changelog. Repeat this phase whenever either changes.

## Phase 6: Evaluate a new prompt version

1. Confirm the baseline run names from the changelog. If a baseline report is missing from `out/`, ask for `read` on it first.
2. Ask for the new experiment twice (`-a`, `-b`), then `read` both.
3. `compare` baseline-a against candidate-a, and candidate-a against candidate-b for flakiness.
4. Triage every `broken` row and every `both fail` row in `stage: regression` per [references/triage.md](references/triage.md).
5. Report in this order: verdict, `must_not_tools` violations, broken rows with bucket and trace id, fixed rows, slices with 20 or more items, flaky rows. Counts, not percentages, for small slices.
6. Recommend one of: ship, fix the prompt (name rows and rule), fix the judge, fix gold (name rows and reason). The developer decides. Ship only when zero `regression` rows remain in `stage: regression`, no `must_not_tools` violation exists, and the `stage: regression` pass rate is at or above the baseline on both runs.
7. If the new version ships, its runs become the baseline. Record them in the changelog.

## Phase 7: Maintain

When a new app, action, tool or prompt rule lands, before the prompt change ships:

1. Read the change: the tool entry in `packages/backend/src/helpers/mcp-bridge-tools.ts`, the app under `packages/backend/src/apps/<key>/`, or the diff between the saved prompt versions under `docs/plans/prompts/`.
2. Add the new rules to the inventory with new ids. Never renumber old ones.
3. Write items per Phase 3. `coverage` already lists a new tool with zero items because it reads the tool list from the backend.
4. `validate`, `push`, changelog line. Re-run Phase 4 step 1 to 3 on the production prompt so the new items get a baseline.

## Reporting

End every phase with: what changed in Langfuse (item count, run names), what changed locally (which notes file), and the exact next command for the developer. Deliverables are pushed items and the local notes. Nothing is committed to the repo by this skill.
