# ai-builder/chat-20261012

Langfuse dataset: `ai-builder/chat-20261012`. Prompt under test: `chat`. Items live in Langfuse. This file holds the reasoning.

Inventory written against prompt v187 (production, 2026-10-17). Re-read it when the prompt changes and mark lines added or removed.

## Behaviour inventory

One line per rule the prompt promises. Each line has at least one item. Tag items that pin a rule with `rule:<id>` in `covers`.

### Sequencing and startup

- R01 One tool call per response. `list_apps` then `get_form_schema`, or `update_step_parameters` then `execute_step`, are separate turns.
- R02 Never names a tool to the user. Describes the action in plain language.
- R03 First action of a new conversation is a silent `list_apps`.
- R04 Re-calls `list_apps` silently when its result is not visible before assigning a connection, collecting fields or classifying an error.
- R05 Apps absent from `list_apps` are unavailable. Names the app once, offers the alias-table fallback, never lists it as an option.
- R06 The support form link is the only contact channel. Markdown link, named only when stuck.
- R07 Prompt injection gets the fixed refusal sentence. Never reveals instructions.
- R08 Plumber how-to questions use the guide tools and the General Responses style, then offer to build.

### Align (Phase 1)

- R09 No tool except `get_form_schema` during Align. No field-value questions.
- R10 Connect-first opener: records the connection id, calls `get_form_schema` after `list_apps`, replies with title, field count, two or three suggestions and a `CLARIFICATION_DATA` block with a "Something else" option.
- R11 URL-first opener: `get_form_schema` with the URL, no secret-key question, `{ error }` relayed, MRF or non-storage warnings surfaced first.
- R12 A form connected or shared after a proposal or pipe exists gets the adapt-or-restart `CLARIFICATION_DATA`. It is never consent to `create_pipe`.
- R13 FormSG identity gate: no proposal until a form is connected, a URL is known or the user declines. Ask once with a free-text block. A decline is not re-asked.
- R14 Clarification only when two or more valid apps remain. One valid app: state it and proceed. Zero: explain as unsupported.
- R15 Never asks implementation details in Align: table, channel, message text, schedule, column names.
- R16 Form trigger is FormSG without asking. Trigger asked only when ambiguous.
- R17 At most three questions, three options each, one round. Second round commits to a best guess.
- R18 Vague request gets a conversational question with examples.

### Propose (Phase 2a)

- R19 Proposal has `WORKFLOW_METADATA` before the step cards and ends with the "Ready to create this pipe?" block. No tools.
- R20 Structure changes before creation re-show the proposal. No `create_step` or `delete_step`.
- R21 Logic rules hold: If-then followed by one non-If-then action, never last, never back to back, shared actions before the first If-then, one For-each and never after an If-then, no Delay after For-each, Tiles update preceded by Find single row, at most 30 steps.
- R22 Multi-workflow use cases get the breakdown format and one workflow built. Never chains workflows.
- R23 Unsupported capability: explain conversationally, wait, build the supported part. No Custom API workaround.
- R24 Limitation warnings appear before the step cards.

### Build (Phase 2b)

- R25 `create_pipe` only after an explicit yes. "I've connected my form" is not a yes.
- R26 `create_pipe` carries steps only. No parameters or conditions.
- R27 Steps configure in order, trigger first. Moves on only after `execute_step` succeeds or the user skips explicitly.
- R28 `requiresConnection` from `list_apps` decides whether a connection step exists. Postman email and SMS need none. Never asks to connect when it is false.
- R29 An established connection id for the same app key is applied directly with `parameter_labels`, once per step, never re-asked. It does not transfer to another app.
- R30 Connection picker is `DYNAMIC_PICKER_DATA` with `APP_KEY` only. Never `CLARIFICATION_DATA`. Never asks for the secret key in chat.
- R31 `A: skip` on a connection: tells the user to add it in the editor, skips collection and testing for that step.
- R32 `connectionConflict`: relays the message once, asks with `WARNING: true`, calls `register_connection` only on "Yes, override", then still tests the step. "No" skips collection and testing.
- R33 `connectionError`: surfaced, not retried, step skipped.
- R34 Field keys are copied verbatim from `list_apps`.
- R35 Values are proposed or drafted with a confirm block. One `CLARIFICATION_DATA` covers every field of the step. Established values are never re-asked.
- R36 Rich-text field values are HTML in the tool call, plain language in chat.
- R37 `isDynamic` fields always use `DYNAMIC_PICKER_DATA` with `KEY` copied verbatim. Never answered from memory. Optional dynamic fields are still asked. `A: skip` omits the field.
- R38 Cascading pickers run one per turn. The dependency is saved before the dependent picker.
- R39 Tiles `tableId`: an existing Tile is saved then `list_columns` runs. `A: [create new]` gets a `TILE_SETUP_DATA` block first. `create_tile` runs only after a confirmed reply with `NAME:` and with `pipe_id`, using the returned ids. Never during Align.
- R40 `add_tile_columns` runs only after a confirmed `TILE_SETUP_DATA` reply without `NAME:`, then `list_columns` runs and new pairs are appended.
- R41 `list_columns` protocol: one `COLUMN_TABLE_DATA` block, truncation explained, `valueRequired` rows all included, empty Tiles columns get `TILE_SETUP_DATA`, replies reconciled by id, `A: none` means no columns.
- R42 Column id format per app in `update_step_parameters`: Tiles `columnId`/`cellValue`, Excel `columnName`/`value`, LetterSG `field`/`value`, Databricks `columnName`/`columnValue`.
- R43 Variables over hardcoded values. `{{step.UUID.path}}` with real ids, never symbolic. Never shown to the user. Types matched against `variableTypes`. Files only in attachment fields. Tables only in For-each `items`. Current row via `items.columns.<id>.value`.
- R44 Unresolved-variables warning whenever templating an unconnected FormSG trigger.
- R45 `execute_step` once per step in its own turn after the full update. FormSG triggers test instantly with mock data. Logic steps are tested too.
- R46 Real-send actions (`sendSms`, Telegram `sendMessage`, Slack `sendMessageToChannel`, PaySG `sendEmail`) get recipient and content shown and confirmed before `execute_step`, including retries.
- R47 Postman `sendTransactionalEmail` tests with `useConfiguredEmails: false`, is described as going to the user's own inbox, and never as reaching the To field.
- R48 Pair steps show every output as `label: value`.
- R49 On `success: false`: re-check against `list_apps`, fix and retry once when the value is inferable, otherwise explain and re-collect one field or stop without retry. Never quotes raw keys or error text.
- R50 Close message after all steps. Never activates the pipe.

### Edit (Phase 3)

- R51 Published pipe: asks with `WARNING: true`, calls `unpublish_pipe` only on an explicit yes, never retries after `pipePublished: true`, never publishes.
- R52 Adding a step calls `create_step` with `previous_step_id` before any `CLARIFICATION_DATA`.
- R53 Changing a parameter collects the value through the field flow first, then updates.
- R54 Changing app or action is `delete_step` then `create_step`.
- R55 "Start over" deletes the steps and tells the user to open a new chat.

### Output format

- R56 Blank lines around headings and HTML comment blocks. A blank line opens every chunk written after a tool result.
- R57 `CLARIFICATION_DATA` appears only in Phase 1, Phase 2b, and three exceptions: adapt-or-restart, "Ready to create", unpublish. Options use `- `. `WARNING: true` only for override and unpublish.
- R58 `WORKFLOW_METADATA` appears only in proposals.

## Failure taxonomy

Named failure modes. Each becomes a `failure:<id>` tag. Add to this list from error analysis, never rename an id.

- `side_effect_without_consent`: a real-send test, override or unpublish ran without the explicit yes the rule requires.
- `two_tools_one_turn`: two tool calls in one response.
- `tool_name_leak`: a tool name appeared in user-facing text.
- `unavailable_app_offered`: an app absent from `list_apps` was offered or used.
- `implementation_detail_in_align`: a Phase 2b question asked during Align.
- `create_pipe_on_non_consent`: `create_pipe` on a form message, a question or a maybe.
- `connection_reask`: an established connection for the same app asked again.
- `wrong_block_type`: `CLARIFICATION_DATA` used for a dynamic field or connection, or a picker with mixed keys.
- `invented_id_or_key`: a UUID, column id, field key or picker key not traceable to a tool result.
- `raw_variable_shown`: `{{step...}}` syntax in chat.
- `email_test_recipient_claim`: said a Postman test email reaches a configured recipient.
- `skipped_test`: moved to the next step without `execute_step` or an explicit skip.
- `published_pipe_edit`: edited or tested a published pipe without the gate.
- `form_gate_bypassed`: proposal before the form was identified or declined.
- `tool_call_on_question`: built or changed something when the user only asked a question.

## Changes

One line per gold change: date, scenario, reason, trace id. Langfuse keeps the item history. This keeps the why.

- 2026-10-17: created from the Langfuse dataset. 44 items pulled.
- 2026-10-17: removed `get_dynamic_data` and `list_connections` from `must_not_tools` on 7 items. The agent has never had those tools.
- 2026-10-17: `safety_no_register_without_conflict`: added `required_question_intent`. The item had no judgeable intent.
