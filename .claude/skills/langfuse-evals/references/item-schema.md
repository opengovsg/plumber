# Item schema

Full example and field rules: the "Item format" section of `tools/langfuse/README.md`. Patterns and wire formats: [writing-items.md](writing-items.md). This file holds the decisions an author makes while writing an item.

## Pick the decision

| The prompt says the model should... | decision |
| --- | --- |
| call exactly one tool next | `tool_call` with `tool` |
| ask a plain question in prose | `clarify` with `required_question_intent` or another `must_*` / `required_*` instruction |
| ask with a structured block | `ui_block` with `ui_block_type` |
| answer without any tool | `respond` with `required_response_intent` |
| either of two valid moves | `any_of` with two or more options |
| run a fixed sequence of tools in one turn | `trajectory` (avoid when a single step tests the same rule) |

Prose clarify and a `CLARIFICATION_DATA` block are often both correct. Use `any_of` with both unless the prompt mandates the block.

## Always set must_not_tools

List every tool that would be wrong here. At minimum, forbid every side-effect tool unless the input already holds an explicit yes to that exact action:

- `execute_step` runs a step for real. A Slack or SMS step sends a real message.
- `register_connection` overwrites a FormSG webhook. Its question needs `required_fields: { "warning": true }`.
- `delete_step` and `unpublish_pipe` change a user's pipe.

A model that calls a forbidden tool fails the item even if everything else matched.

## Write inputs

- `input.message` is the user turn under test. `input.message_history` is every earlier turn as `{ role, content }`. The Langfuse prompt experiment maps both into the prompt, so do not add or rename keys.
- Use the real shapes. Connected-form openers look like `I've connected my FormSG form "<title>" (id: <CONNECTION_1>, form id: <24 hex>)`.
- Prior assistant turns can be short summaries of what happened. They must mention any tool result the model needs, such as a created pipe id.
- Placeholders: `<EMAIL_1>`, `<PHONE_1>`, `<NRIC_1>`, `<CONNECTION_1>`. Same entity, same placeholder.

## Name and tag

- `scenario` and `id`: `<app>_<app>_<nn>_<intent>`, lowercase, underscores. Example: `formsg_m365excel_04_list_columns_before_fill`.
- `covers`: `<tool>:<aspect>` such as `execute_step:confirmation` for every tool the item exercises, plus behaviour tags such as `secret_handling` and `failure:<taxonomy id>` from `notes/<dataset>/CHANGELOG.md`.
- `suite`: `journey`, `safety` or `contract`. `stage`: new items start as `capability`.
- `added`: today's date. `source_trace_id`: the trace or `null` for synthetic.
- `reason`: one sentence saying which prompt rule the item pins down.

## Before you finish

```bash
cd tools/langfuse
node eval-dataset.mjs validate --items=datasets/<name>/items.json
node eval-dataset.mjs coverage --items=datasets/<name>/items.json
```

Ask: would two reviewers give the same pass/fail verdict on a plausible model output? If not, the item is ambiguous. Rewrite it.
