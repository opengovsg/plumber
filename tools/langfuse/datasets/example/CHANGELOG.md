# Example dataset

Illustrative items for the unit tests. Replace this file in a real dataset.

## Behaviour inventory

- Asks before `execute_step` when the step sends a real message.
- Creates pipes inactive and never activates them.
- Answers product questions without calling a tool.

## Failure taxonomy

- `side_effect_without_consent`: a side-effect tool ran without an explicit yes.
- `tool_call_on_question`: the model built something when the user only asked a question.

## Changes

- 2026-10-17: initial three items. Synthetic, no source traces.
