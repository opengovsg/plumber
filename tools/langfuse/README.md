# Langfuse tools

Scripts and a step-by-step process for the AI Builder prompt evals. The goal: a gold dataset in git that pins down what the production `chat` prompt must do, a calibrated judge, and a repeatable way to say whether a new prompt version is better.

## Before you start

1. Follow the root [README](../../README.md) once: `nvm use`, `pnpm install`, the 1Password desktop app, and `op-dev.json`. The dev 1Password environment holds the Langfuse keys (`PAIR_ROME_*`).
2. Run every command below from `tools/langfuse`.
3. Commands marked **Langfuse** go through `pnpm run eval-dataset ...` so 1Password injects the keys. They prompt for biometrics once. Commands marked **offline** run with `node eval-dataset.mjs ...` and need nothing.
4. Check Langfuse access: open the `aiBuilder` project and find the dataset `ai-builder/chat-20261012` and the evaluator that writes `tool_intent_correctness`.

## Layout

| Path | Purpose |
| --- | --- |
| `datasets/<name>/items.json` | Gold items. Git is the source of truth. Langfuse holds a pushed copy. A `/` in the dataset name becomes a directory, so `ai-builder/chat-20261012` lives at `datasets/ai-builder/chat-20261012/`. |
| `datasets/<name>/judge-labels.json` | Human labels for judge calibration. |
| `datasets/<name>/CHANGELOG.md` | Behaviour inventory, failure taxonomy, and one line per gold change. |
| `datasets/example/` | Three illustrative items used by the tests. Not a real suite. |
| `out/` | Run reports, proposals and trace candidates. Ignored by git. |
| `lib/` | Pure functions with unit tests. |
| `../../.claude/skills/langfuse-evals/` | Agent skill that follows this README. |

## Commands

`--dataset=<name>` is the Langfuse dataset name. With it, `--items` defaults to `datasets/<name>/items.json`. Pass `--project=pairAction` to use the other Langfuse project. The default is `aiBuilder`.

| Command | Mode | What it does |
| --- | --- | --- |
| `pnpm run get-prompt chat --label=production` | Langfuse | Saves the prompt to `docs/plans/prompts/chat_v<N>.md`. |
| `pnpm run eval-dataset pull --dataset=<name> [--include-archived] [--force]` | Langfuse | Imports the Langfuse items into `items.json` and creates `CHANGELOG.md`. |
| `node eval-dataset.mjs init --dataset=<name> [--stubs]` | offline | Creates an empty dataset folder. `--stubs` adds draft items for every agent tool. |
| `pnpm run eval-dataset sample --from=<iso> [--to=<iso>] [--limit=100] [--tags=ai-builder] [--environment=<env>]` | Langfuse | Writes redacted draft items from production traces to `out/candidates/<date>.json`. |
| `node eval-dataset.mjs adopt --dataset=<name> --candidates=<path> --trace=<trace id> --scenario=<name>` | offline | Copies one candidate into `items.json` as a draft. |
| `node eval-dataset.mjs validate --dataset=<name>` | offline | Checks item shape, tool names, duplicate ids and leftover drafts. |
| `node eval-dataset.mjs coverage --dataset=<name> [--json=<path>]` | offline | Counts items per decision, tool, app and tag. Lists gaps. Drafts count. |
| `pnpm run eval-dataset push --dataset=<name> [--archive-missing]` | Langfuse | Upserts items into the Langfuse dataset by id. Refuses drafts and invalid items. |
| `pnpm run eval-dataset read --dataset=<name> [--run=<run>] [--score=tool_intent_correctness]` | Langfuse | Writes `out/<dataset>/<run>.json` with every item's pass/fail and the failures in full. Default run: the newest. |
| `node eval-dataset.mjs compare --baseline=<report> --candidate=<report> [--min-slice=20] [--json=<path>]` | offline | Pairs two runs item by item. Exit code 1 on regression. |
| `node eval-dataset.mjs improve --report=<report> [--dataset=<name> --apply] [--push]` | offline, push is Langfuse | Proposes safe gold edits for failures. Never drops `must_not_tools`. |
| `node eval-dataset.mjs calibrate --report=<report> --write-template=<labels path>` | offline | Writes up to 50 judge-pass and 50 judge-fail rows for a human to label. |
| `node eval-dataset.mjs calibrate --report=<report> --labels=<labels path> [--min=0.9]` | offline | Compares human labels with the judge. Exit code 1 when either rate is below the minimum. |
| `pnpm test` | offline | Unit tests for `lib/`. |

## Item format

```json
{
  "id": "formsg_slack_09_confirm_before_test",
  "input": { "messages": [{ "role": "user", "content": "..." }] },
  "expected_output": {
    "decision": "any_of",
    "options": [
      { "decision": "clarify" },
      { "decision": "ui_block", "ui_block_type": "CLARIFICATION_DATA" }
    ],
    "must_not_tools": ["execute_step"],
    "required_question_intent": "Confirm that sending a real Slack message is acceptable.",
    "reason": "execute_step sends a real message."
  },
  "metadata": {
    "scenario": "formsg_slack_09_confirm_before_test",
    "covers": ["tool:execute_step", "app:slack", "decision:clarify", "failure:side_effect_without_consent"],
    "suite": "regression",
    "added": "2026-10-17",
    "source_trace_id": "..."
  }
}
```

- `id` is the Langfuse item id. It must be unique across the whole Langfuse project. Pulled items keep their Langfuse id. New items use the scenario name.
- `input` is the conversation up to the turn under test. **Its keys must match what the Langfuse prompt experiment maps into the prompt.** After `pull`, copy the input shape of an existing item for every new one. The `messages` array above is what `sample` produces from production traces. If the pulled items use another key, rename it when you adopt a candidate.
- `expected_output.decision` is one of `tool_call`, `clarify`, `ui_block`, `respond`, `any_of`, `trajectory`.
  - `tool_call` needs `tool`.
  - `ui_block` needs `ui_block_type`: `CLARIFICATION_DATA`, `DYNAMIC_PICKER_DATA`, `COLUMN_TABLE_DATA` or `TILE_SETUP_DATA`.
  - `clarify` needs `required_question_intent`. `respond` needs `required_response_intent`. The judge grades intent, not wording.
  - `any_of` lists two or more acceptable options. Use it when the prompt allows more than one correct move.
  - `trajectory` lists ordered tool steps. Prefer single-step items. Trajectories are brittle.
- `must_not_tools` lists tools whose call fails the item regardless of anything else. Every item that could tempt a side-effect tool (`execute_step`, `register_connection`, `delete_step`, `unpublish_pipe`) must forbid it unless the input already carries explicit consent.
- `required_fields` names fields the UI block must set, for example `{ "warning": true }` for the FormSG webhook overwrite question.
- `metadata.covers` tags drive the coverage and slice reports. Use `tool:<name>`, `app:<key>`, `decision:<decision>` and `failure:<taxonomy id>`.
- `metadata.suite`: `regression` (expected near 100%), `capability` (known hard cases, low pass rate), `holdout` (run rarely, never used to tune the prompt).
- `metadata.status: "draft"` marks an item a human has not finished. `push` refuses drafts.

## Part A: build the gold dataset from the production prompt

Each step names who does it. Manual steps are marked. Steps 1 to 4 take an afternoon. Steps 5 to 8 take a few days of reviewer time spread over a week.

### Definition of done

- Every line of the behaviour inventory has at least one item.
- `coverage` reports no gaps.
- `validate` passes and `push` has run.
- The judge passed calibration (step 8).
- The baseline run (step 9) has zero untriaged failures in `suite: regression`.
- Two reviewers signed off in `CHANGELOG.md`.

### 1. Bring the dataset under git (once)

```bash
pnpm run eval-dataset pull --dataset=ai-builder/chat-20261012
node eval-dataset.mjs validate --dataset=ai-builder/chat-20261012
node eval-dataset.mjs coverage --dataset=ai-builder/chat-20261012
```

`pull` keeps the Langfuse item ids, so the next `push` updates the same rows. `validate` lists what the imported items lack, usually `covers` tags and `suite`. Add those by hand in `items.json`. Give every imported item `"suite": "regression"` for now. Step 9 moves the ones that fail on the production prompt. Commit `items.json` and `CHANGELOG.md`.

For a brand-new dataset instead:

```bash
node eval-dataset.mjs init --dataset=<name> --stubs
```

`init` creates the folder, a `CHANGELOG.md` template and, with `--stubs`, a draft item per tool. Each stub holds a `TODO` input. The author replaces it, decides the expected output and removes `metadata.status`. Create the dataset in Langfuse (Datasets, New dataset, same name) before the first push.

### 2. Fetch the production prompt and write the behaviour inventory (manual)

```bash
pnpm run get-prompt chat --label=production
```

Read the saved file. In `CHANGELOG.md` under "Behaviour inventory", write one line per rule the prompt promises. Examples: "asks before `execute_step` when the step sends a message", "never activates a pipe", "uses `list_columns` before filling multirow fields". Also list every tool from `coverage` with the rule that governs it. Every line becomes at least one item in step 5.

### 3. Sample production traces

```bash
pnpm run eval-dataset sample --from=2026-10-01T00:00:00Z --limit=150
```

The command reads traces tagged `ai-builder` and writes `out/candidates/<date>.json`. Each candidate holds the redacted conversation, what production did (`metadata.observed`) and the source trace id. The summary prints strata such as `tool_call:create_pipe` or `clarify`. Pass `--environment=production` only if traces in Langfuse carry an environment value. Check one trace in the UI first.

Pick 30 to 50 candidates:

- Take some from every stratum. Random sampling floods the set with the common path.
- Prefer traces with negative chat feedback, tool errors, long turn counts or a user who repeated themselves. Those hold the failures.
- Redaction covers emails, NRICs and phone numbers. Read every candidate for anything else personal and replace it by hand. The dataset must never hold raw personal data.

### 4. Error analysis (manual)

For each picked candidate, write one short note: what the model did and whether it was right. Group the notes into a failure taxonomy of 5 to 10 named failure modes, for example `side_effect_without_consent`, `tool_call_on_question`, `guessed_column_names`. Record the taxonomy in `CHANGELOG.md`. Each failure mode becomes a `failure:<id>` tag.

Stop sampling when new traces stop adding failure modes.

### 5. Write the gold (manual, two people)

For each picked candidate:

```bash
node eval-dataset.mjs adopt --dataset=ai-builder/chat-20261012 --candidates=out/candidates/<date>.json --trace=<trace id> --scenario=<app>_<app>_<nn>_<short_intent>
```

`adopt` appends a draft item. Then in `items.json`:

1. Decide the correct decision from the prompt and the behaviour inventory, not from what production did. `metadata.observed_decision` is evidence, not the answer.
2. Fill `expected_output`, including `must_not_tools` and `reason`.
3. Set `covers` and keep `suite: capability`. Remove `metadata.status`.
4. Make the `input` keys match the existing items.

Rules:

- Two reviewers must agree on pass/fail for an item before it moves to `regression`. If they disagree, the item is ambiguous. Rewrite it or drop it.
- Write items where the tool should fire and items where it must not. One-sided items train one-sided prompts.
- Never copy an item into the prompt as a few-shot example.

### 6. Fill coverage gaps

```bash
node eval-dataset.mjs coverage --dataset=ai-builder/chat-20261012
```

For every tool the report lists with zero expected or zero forbidden items, and for every inventory line without an item, write synthetic items from the prompt's rules. Minimum per tool: one should-fire, one must-not-fire, and for side-effect tools one clarify item. Mark synthetic items with `"source_trace_id": null`.

### 7. Validate and push

```bash
node eval-dataset.mjs validate --dataset=ai-builder/chat-20261012
pnpm run eval-dataset push --dataset=ai-builder/chat-20261012
```

`push` upserts by id. Items in Langfuse that are not in the file are listed. Pass `--archive-missing` to archive them. Langfuse records a dataset version on every change, so an experiment always names the item set it ran on. Commit.

### 8. Check the judge (manual)

1. In Langfuse, open the evaluator that writes `tool_intent_correctness`. It must be a BOOLEAN score scoped to the dataset, with `expected_output` and the model output mapped into the template. The judge prompt must check one thing: did the model's decision match the gold. It should write a short critique before the verdict, treat a call to any `must_not_tools` entry as a fail, and treat an `any_of` match as a pass. Edit it to match if it does not.
2. Run the baseline experiment and read it (step 9, first two commands). Then:
   ```bash
   node eval-dataset.mjs calibrate --report=out/ai-builder_chat-20261012/<run>.json --write-template=datasets/ai-builder/chat-20261012/judge-labels.json
   ```
   The file holds up to 50 judge-pass and 50 judge-fail rows. A reviewer opens each trace, reads the gold, and sets `human` to `pass` or `fail` without looking at the `judge` field first. Commit the file.
3. Check agreement:
   ```bash
   node eval-dataset.mjs calibrate --report=out/ai-builder_chat-20261012/<run>.json --labels=datasets/ai-builder/chat-20261012/judge-labels.json
   ```
   The true positive rate (judge pass when human pass) and true negative rate (judge fail when human fail) must both be at least 90%. Judges fail the second rate far more often than the first. Below 90%, fix the judge prompt, re-run the evaluator on the same run (the evaluator's scope setting for past dataset runs, or a batch evaluation on the run's traces), `read` again, and check again.
4. Pin the judge to a dated model version. Re-run this calibration whenever the judge prompt or model changes.

Why labels live in the repo and not in a Langfuse annotation queue: the file is reviewable in a pull request, it travels with the gold it judges, and the `calibrate` command reads it directly. Annotation queues suit several annotators labelling live traces in the UI. Move to a queue when more than two people label at once.

### 9. Baseline run and triage

Run an experiment on the dataset with the production prompt version (Part B, step 1). Then:

```bash
pnpm run eval-dataset read --dataset=ai-builder/chat-20261012 --run=<run name>
node eval-dataset.mjs improve --report=out/ai-builder_chat-20261012/<run>.json
```

Triage every failure with the table in Part B, step 3. On the production prompt there is no `regression` bucket yet, so each failure is one of: `judge_miss` (fix the judge), `gold_error` (fix the gold), or a real miss. A real miss on an item in `regression` means the item moves to `capability`. Fix all of these before anyone changes the prompt. Keep the report file. It is the baseline for the next comparison. Record the run name in `CHANGELOG.md`.

## Part B: evaluate a new prompt version

### 1. Run the experiment

In Langfuse: Datasets, open the dataset, New experiment. Choose the prompt version under test, the LLM connection, the structured output schema and the `tool_intent_correctness` evaluator. Name the run `chat-v<version>-<yyyymmdd>`. Run it twice, with `-a` and `-b` suffixes. Nondeterministic rows show up as rows that flip between the two runs.

### How the UI experiment differs from production

The UI experiment sends the prompt and the dataset messages to a model and asks for a JSON decision through a structured output schema. Production runs `streamText` with the real tool definitions from `mcp-bridge-tools.ts`, up to 10 tool steps, and a system prompt that `buildSystemPrompt` edits per user. The gaps, in order of how much they move results:

1. **The model declares a decision instead of calling a tool.** Tool choice is driven by the tool descriptions and input schemas the model sees. The UI run sees whatever copy of them sits in the prompt or schema. That copy drifts from `mcp-bridge-tools.ts` every time a tool description changes.
2. **Multi-step turns are flattened.** Production often calls `list_columns` then `update_step_parameters` in one turn. The UI run grades the first declared decision only.
3. **The system prompt is not the one users get.** Restricted apps, the support URL and the established-connection reminder are added at request time.

What the UI experiment is good for: regression checks on prompt wording for clarify, respond and must-not decisions, and fast iteration without code. Keep using it for those.

What closes the gaps: an SDK experiment runner in `packages/backend` that calls `langfuse.experiment.run` with the dataset items, builds the system prompt with `buildSystemPrompt`, passes the real tools from `createMcpBridgeTools` with their `execute` functions replaced by recorders, stops after one step, and returns the tool call or text. Code evaluators then score forbidden tool calls and expected tool matches deterministically before the Langfuse judge runs on the same run. This gives one eval path that cannot drift from production. It is the next piece of work after Part A is done.

### 2. Read and compare

```bash
pnpm run eval-dataset read --dataset=ai-builder/chat-20261012 --run=chat-v155-20261017-a
node eval-dataset.mjs compare --baseline=out/ai-builder_chat-20261012/chat-v154-20261010-a.json --candidate=out/ai-builder_chat-20261012/chat-v155-20261017-a.json
```

Report file names come from the dataset and run names with `/` and spaces replaced by `_`. The compare output lists rows that moved from pass to fail (`broken`), fail to pass (`fixed`) and per-tag slices. Read it this way:

- Any `broken` row in `suite: regression` blocks the prompt until triaged.
- Slice deltas on fewer than 20 items are smoke tests. Report counts, not percentages.
- Fewer than 20 flips in total is noise unless the same rows flip on the second run.
- A pass-rate change with no `broken` rows is an improvement. A change with both is mixed. Read the rows.

### 3. Triage every failure

Put each failing row into one bucket before touching the prompt:

| Bucket | Signal | Action |
| --- | --- | --- |
| `judge_miss` | Gold already allows the output. `improve` reports `judge_miss`. | Fix the judge prompt. Do not edit gold. |
| `gold_error` | Two reviewers agree the model was right and the gold is wrong. | Edit gold with a `CHANGELOG.md` line and the trace id. |
| `flaky` | Passes on one of the two runs. | Keep. Count it in the pass^2 figure. Consider a tighter prompt rule. |
| `regression` | Model wrong, gold right, passed on the baseline. | Fix the prompt. |
| `known_gap` | Model wrong, gold right, also failed on the baseline. | Leave in `capability`. |

`improve` automates the two gold edits that are always safe and marks judge misses. Review its `skip` rows by hand. `improve --apply --dataset=<name>` writes the safe edits into `items.json`. Then `push`.

### 4. Decide

Ship the prompt when: zero `regression` rows remain in `suite: regression`, no `must_not_tools` violation anywhere, and the `regression` suite pass rate on both runs is at or above the baseline. Record the decision and both run names in `CHANGELOG.md`.

## Part C: maintain the dataset

When a new app, action, tool or prompt rule lands:

1. Add items before the prompt change ships: one should-fire, one must-not-fire, one clarify item for side-effect tools, and one item per new rule in the behaviour inventory. A new tool shows up in `coverage` with zero items as soon as it exists in `mcp-bridge-tools.ts`.
2. New items start in `capability`. Move them to `regression` after they pass on two consecutive runs.
3. Run `coverage` and `validate`, then `push`.
4. Add a `CHANGELOG.md` line.

Other rules:

- Every gold edit needs a reason and the trace id that motivated it.
- Retire an item by archiving it, not deleting it. Past runs still reference it.
- Keep 10% of items in `holdout`. Run them once per quarter. Never tune the prompt against them.
- When production fails in a new way, turn the trace into an item the same week.
- Keep the tool descriptions or structured output schema used by the UI experiment in sync with `mcp-bridge-tools.ts` until the SDK runner exists. Check them whenever that file changes.
- If `knownTools()` in `lib/tools.mjs` cannot read `packages/backend/src/helpers/mcp-bridge-tools.ts`, tool names are not checked. Run from a full checkout.

## Langfuse platform note

The team runs Langfuse v3.167.4. `read` and `pull` use the v3 dataset endpoints and `GET /api/public/traces/{id}`. Langfuse platform v4 deprecates those in favour of `/api/public/experiments` and `/api/public/experiment-items`. If `read` returns 404 or 410 after a Langfuse upgrade, update `lib/read-run.mjs` to the new endpoints and bump `@langfuse/client`. Dataset versioning (the Version toggle on the Items tab, and the `version` filter on item lists) arrived in v3 during late 2025. If the toggle is missing, upgrade before relying on version pins.
