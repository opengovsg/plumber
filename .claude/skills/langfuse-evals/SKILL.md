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

Ignore `datasets/example`. It is a unit-test fixture. One other local copy and no other answer means that dataset. Several, or none, means ask. A new dataset starts with `init --dataset=<name>` and must also be created in Langfuse before the first push. Use the chosen name as `<dataset>` in every command below. A `/` in the name becomes a directory locally, and `_` in the `out/` report folder.

`datasets/`, `notes/`, `out/` and `docs/plans/prompts/` are gitignored. A search that skips ignored files reports nothing. List them from the shell before concluding they are missing.

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

The notes are gitignored. For `ai-builder/chat-20261012`, the source of truth is the [Notion changelog](https://app.notion.com/p/3fc77dbba7888161ba33d0b426eadad6). The local file is the working copy. Reconcile the two before copying either way. Never replace the page, or the file, from the other unread.

Reconcile like this:

1. Read **Where to continue** and the **Changes** lines after the last shared date in both copies. Use the OGP gateway Notion tools: `notion_notion_fetch` to read the page, then `notion_notion_update_page` with `command: update_content`. Never use `replace_content`. If the gateway is not authenticated, ask the developer to connect it. Do not paste over the page unread.
2. List three groups: only in the local file, only on the page, and the same section with different text.
3. Merge the first two groups into the local file. Stop on the third group and ask which wording wins.
4. After the developer confirms the merged file, ask them to update the page so it matches that file. Do not end the session while a confirmed local change is still missing from the page.

If the local changelog has **Where to continue**, that section is the session. Read it before any phase work. Tell the developer the dataset, the next unfinished step, and what that step produces. Do not restart a phase the section marks done. The phase table above is only for a dataset with no such section.

Tell the developer which dataset and phase you are in and what the phase produces before running anything.

## Push when a tool is on another branch

`validate` and `push` check tool names against `packages/backend/src/helpers/mcp-bridge-tools.ts` on the current checkout. An unknown-tool error means the item names a tool this branch does not define. The changelog names the branch that does. From the repo root, swap that file in, push, and restore it. Do not commit the swap.

```bash
git show <branch>:packages/backend/src/helpers/mcp-bridge-tools.ts > packages/backend/src/helpers/mcp-bridge-tools.ts
(cd tools/langfuse && pnpm run eval-dataset push --dataset=<dataset>)
git checkout -- packages/backend/src/helpers/mcp-bridge-tools.ts
```

`cd tools/langfuse && pnpm ...` leaves the shell in `tools/langfuse`. A following `git checkout -- packages/...` then fails. Use the `(cd ...)` form above so the restore runs from the repo root.

A gold edit does not get an experiment of its own. Langfuse cannot re-score an old run. The next run is the one **Where to continue** names. Say whether the last traces still fail the new gold.

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

1. Run `node eval-dataset.mjs calibrate --report=out/.../<baseline a>.json --dataset=... --write-template`. It writes `notes/<dataset>/judge-labels.json` with up to 50 judge-pass and 50 judge-fail rows. Judge-fail rows carry the misses, so add the second run's failures with `--report=<b> --write-template --append --only=fail`. Every row must come from one judge version; `pnpm run get-judge <evaluator> --diff=<draft>` shows which draft scored a run.
2. The developer labels `human` on each row from the trace and the gold without reading the `judge` column. You never fill `human`.
3. Run `calibrate --report=<a>,<b> --dataset=...`. Both rates must reach 90%. Below that, sort the disagreements: a label against the prompt rule is a rule decision for the developer, a wrong gold is a gold edit and the row is excluded from the rate, the rest are judge misses. Propose judge prompt changes for the misses only. Langfuse cannot re-score an existing experiment, so the developer pastes the judge and runs one bridge run on the production prompt; label its judge-fail rows plus a 25-row pass sample. Repeat.
4. Note the judge model and prompt version in the changelog. Repeat this phase whenever either changes.

## Phase 6: Evaluate a new prompt version

1. Confirm the baseline run names from the changelog. If a baseline report is missing from `out/`, ask for `read` on it first.
2. Follow **Where to continue** when it says the run waits on a merge or a gold rewrite. Do not ask for the experiment yet. Otherwise ask for one experiment (`-a`), then `read` it. A full run costs several USD. The changelog has the last figure. Iterate on one run. Ask for `-b` only when the candidate is a ship candidate, or when `-a` flips a `stage: regression` row. When the harness or the judge changed since the baseline, ask for one bridge run on the production prompt first: every difference against the baseline is then judge or variance, not prompt. Change one of prompt, harness and judge per pair. Before the developer names the run, they run `pnpm run get-prompt <prompt> --label=latest` and confirm the saved file is that version.
3. `compare` baseline-a against candidate-a. When `-b` exists, also compare candidate-a against candidate-b for flakiness.
4. Triage every `broken` row and every `both fail` row in `stage: regression` per [references/triage.md](references/triage.md).
5. Report in this order: verdict, `must_not_tools` violations, broken rows with bucket and trace id, fixed rows, slices with 20 or more items, flaky rows (two runs only). Counts, not percentages, for small slices. Give the `stage: regression` count raw and judge-corrected (judge misses discounted); rows that flip on identical prompts belong on a watch list, not in the verdict.
6. Recommend one of: ship, fix the prompt (name rows and rule), fix the judge, fix gold (name rows and reason). The developer decides. Ship only when both runs have no `must_not_tools` violation, no `stage: regression` row that fails both runs, and a judge-corrected `stage: regression` pass rate at or above the baseline. The ship gate always needs both runs. `compare` calls a row that passed the baseline and failed the candidate `broken`. A row that fails both and also failed the baseline is `known_gap` unless its stage is `regression`, in which case it still blocks the ship.
7. If the new version ships, its runs become the baseline. Record them in the changelog.

## Phase 7: Maintain

When a new app, action, tool or prompt rule lands, before the prompt change ships:

1. Read the change: the tool entry in `packages/backend/src/helpers/mcp-bridge-tools.ts`, the app under `packages/backend/src/apps/<key>/`, or the diff between the saved prompt versions under `docs/plans/prompts/`.
2. Add the new rules to the inventory with new ids. Never renumber old ones.
3. Write items per Phase 3. `coverage` already lists a new tool with zero items because it reads the tool list from the backend.
4. `validate`, `push`, changelog line. Re-run Phase 4 step 1 to 3 on the production prompt so the new items get a baseline.

## Reporting

End every phase with: what changed in Langfuse (item count, run names), what changed locally (which notes file), and the exact next command for the developer. Deliverables are pushed items and the local notes. Nothing is committed to the repo by this skill.

Keep **Where to continue** at the top of `notes/<dataset>/CHANGELOG.md`. Name the production version, the next step, the exact command, and anything waiting on a PR. A later session reads it first and must be able to act without this conversation. Then reconcile with the Notion page, using the steps under Start here, before the page is updated.
