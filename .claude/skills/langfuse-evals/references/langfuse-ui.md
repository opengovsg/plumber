# Langfuse UI steps

The developer does these in the browser. Give the steps and the names to use.

## Run an experiment on the dataset

1. Datasets, open `<dataset>`, New experiment.
2. Prompt: the one the dataset tests (`chat` for the AI Builder), pick the version under test. Production is the version with the `production` label.
3. LLM connection: the one the team uses for experiments.
4. Structured output: the existing decision schema.
5. Evaluator: `tool_intent_correctness`.
6. Run name: `chat-v<version>-<yyyymmdd>-a`. Repeat with `-b` for a baseline (Phase 4) or a ship candidate (Phase 6). Plain iteration runs once. Langfuse appends a timestamp to the name. `read --run=<name>` accepts the typed prefix when it matches one run.

The experiment maps the item `input` keys into the prompt variables. Run `inspect` to see which keys the dataset uses. Items with other keys fail.

## Re-run the judge, or compare two judges

Batch evaluation on past traces does not work for this judge: it maps variables from the observation only, and the gold (expected output) exists only inside prompt experiments. Run a new experiment instead and select every evaluator you want in the setup. Each writes its own score on the same traces. `read --score=<name>` saves a non-default score to `<run>__<score>.json`, so `compare` can pair the two reports. Rows that differ are judge disagreements.

## See the dataset as it was at a run

Datasets, Items tab, Version toggle. Pick the timestamp of the run. Every push creates a version, so a gold edit can be undone by pushing the earlier items again.

## Known gap

UI experiments ask the model for a JSON decision through the structured output schema. Production calls real tools from `mcp-bridge-tools.ts` with up to ten steps. The UI run cannot see tool descriptions unless the schema or prompt copies them. Keep that copy in sync when `mcp-bridge-tools.ts` changes. An SDK runner in `packages/backend` that uses the real tools with recorded `execute` functions is the fix. It is a separate piece of work.
