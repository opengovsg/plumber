## Langfuse tools

Scripts here use the same Langfuse client and 1Password env injection as the backend helper `getLangfuseClient`.

## Fetch a prompt

```bash
cd tools/langfuse
pnpm run get-prompt chat --label=latest
```

The file lands in `docs/plans/prompts/`.

## Read an eval run and update the dataset

Tell an agent to run this from `tools/langfuse` after a Prompt Experiment:

```bash
pnpm run eval-dataset read --dataset <langfuse-dataset-name>
pnpm run eval-dataset improve --report out/<dataset>/<run>.json --items <path-to-items.json>
```

`read` writes every false `tool_intent_correctness` row. Pass `--run=<name>` to pick a run. The default is the newest run. Pass `--score=<name>` when the judge score has another name.

`improve` writes `*.proposals.json` next to the report.

- `update` is a safe gold edit. A prose clarify that came back as `CLARIFICATION_DATA` becomes `any_of`. A real Slack or SMS confirm drops `warning: true`. That flag stays on FormSG webhook overwrite.
- `skip` means the model called a forbidden tool, or the mismatch is not one of those two edits. Leave the row.
- `judge_miss` means the gold already allowed the model decision. Re-paste the judge. Do not change the row.

`--apply` writes the updates into `--items`. `--push` upserts those expected outputs on the Langfuse dataset. Use `--push` only after the proposals look right.

If `build_dataset.py` generates `items.json`, edit the Python file to match the proposal. The next generate overwrites `items.json`.

```bash
pnpm test
```
