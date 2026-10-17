# Writing items

An item replays the conversation up to one turn and states what the prompt requires next. Match the dataset's existing shapes exactly. Run `inspect` first and copy its key names.

## Input

- `message`: the user turn under test.
- `message_history`: every earlier turn as `{ role, content }`, oldest first.
- Assistant turns can be short summaries of what happened, but they must carry every fact the model needs next: pipe id, step ids, tile id, connection id, which block was just emitted. Write the block itself when the next turn depends on its exact content, for example a `TILE_SETUP_DATA` block the user is replying to.
- Frontend wire formats for user replies, taken from the backend parsers and the prompt:
  - Picker answer: `A: <Name> (id: <id>)`, or `A: skip`, or `A: [create new]`, or `A: [no options available: <reason>]`.
  - Tile setup reply: `Q: <question>\nA:\nNAME: <name>\nCOLUMNS:\n- <col>` (no `NAME:` line for add-columns).
  - Column table reply: `Q: <question>\nA:\n- <Column> (id: <columnId>): <text>` or `A: none`.
  - Connected-form opener: `I've connected my FormSG form "<title>" (id: <connection id>, form id: <24 hex>). Suggest workflows I can build with this form.`
  - Clarification option: the option text verbatim, for example `Yes, unpublish and continue`.
- Ids: pipes and steps are UUIDs, Tiles are ULIDs, FormSG form ids are 24 hex characters. Use placeholders `<CONNECTION_1>`, `<EMAIL_1>`, `<PHONE_1>` for personal data. Same entity, same placeholder.

## Expected output by decision

| The prompt requires | decision | Also set |
| --- | --- | --- |
| exactly one tool call next | `tool_call` + `tool` | `required_args` for ids and names that must come from history, `must_not_invent_ids: true` |
| a structured block | `ui_block` + `ui_block_type` | `required_fields` such as `{ "warning": true }` or `{ "name": true }`, `required_question_intent` |
| a question in prose | `clarify` | `required_question_intent` |
| a plain answer, no tool | `clarify` or `respond` | `required_response_intent`, plus `must_relay`, `must_not_invent_schema` and similar |
| either of two valid moves | `any_of` + `options` | the shared `must_not_tools` |

Always set `must_not_tools`. Forbid every side-effect tool unless the history carries an explicit yes to that exact action, and forbid the tool the item is a guard against.

Other instruction keys the judge reads: any `must_*` or `required_*` key. Reuse the names `inspect` shows before inventing new ones. Add `reason` with the rule id and one sentence.

## Patterns

**Should-fire.** History ends with the condition the prompt names (confirmed reply, saved dependency, explicit yes). Expected: `tool_call` with `required_args` from history.

**Must-not-fire.** Same situation minus the condition, or a request that looks like the tool but belongs to another app or phase. Expected: the block or question the prompt requires instead, with the tool in `must_not_tools`.

**Confirm-first.** The user asks for the side-effect outcome without the exact confirmation. Expected: `any_of` of `clarify` and the `CLARIFICATION_DATA` block, `required_question_intent` naming what consent is needed, the tool in `must_not_tools`.

**Phase guard.** A Phase 2b question or tool during Align, or a Phase 3 tool before the pipe exists. Expected: the Align or 2a output, all pipe tools forbidden.

**Judge instruction only.** The decision is clear but the wording matters, for example the email test recipient. Expected: `clarify` or `respond` with a `must_not_*` key naming the banned claim.

## Metadata

- `scenario` and `id`: `<area>_<nn>_<intent>` in lowercase, for example `tiles_02_create_tile_after_confirmed_reply`.
- `covers`: `<tool>` or `<tool>:<aspect>`, block names, `app:<key>`, `failure:<id>`, `rule:<id>`.
- `suite`: `journey` for multi-turn flows, `safety` for guardrails, `contract` for single tool or block behaviour.
- `stage`: `capability` for new items.
- `added`, `source_trace_id` (or `null`).

## Before handing a batch to the developer

```bash
cd tools/langfuse
node eval-dataset.mjs validate --dataset=<name>
node eval-dataset.mjs coverage --dataset=<name>
```

Ask of each item: would two reviewers give the same pass/fail verdict on a plausible model output? If not, rewrite it.
