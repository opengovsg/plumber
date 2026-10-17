# Langfuse UI steps

The developer does these in the browser. Give the steps and the names to use.

## Run an experiment on the dataset

1. Datasets, open `ai-builder/chat-20261012`, New experiment.
2. Prompt: `chat`, pick the version under test. Production is the version with the `production` label.
3. LLM connection: the one the team uses for experiments.
4. Structured output: the existing decision schema.
5. Evaluator: `tool_intent_correctness`.
6. Run name: `chat-v<version>-<yyyymmdd>-a`. Repeat with `-b`.

The experiment maps the item `input` keys `message` and `message_history` into the prompt. Items with other keys fail.

## Re-run the judge on an existing run

Evaluation, LLM-as-a-judge, open the `tool_intent_correctness` evaluator. Either set its scope to past dataset runs for this dataset, or select the run's traces and start a batch evaluation. The judge writes new scores on the same traces. `read` picks the newest score per trace.

## See the dataset as it was at a run

Datasets, Items tab, Version toggle. Pick the timestamp of the run. Every push creates a version, so a gold edit can be undone by pushing the earlier items again.

## Known gap

UI experiments ask the model for a JSON decision through the structured output schema. Production calls real tools from `mcp-bridge-tools.ts` with up to ten steps. The UI run cannot see tool descriptions unless the schema or prompt copies them. Keep that copy in sync when `mcp-bridge-tools.ts` changes. An SDK runner in `packages/backend` that uses the real tools with recorded `execute` functions is the fix. It is a separate piece of work.
