# Resolving app/trigger/action keys

`steps.app_key` + `steps.key` + `steps.type` store opaque string literals (`'slack'` /
`'sendMessageToChannel'` / `'action'`). The human-readable names only exist in code, under
[packages/backend/src/apps/](../../../../packages/backend/src/apps/). Whenever a question names an
app, trigger, or action by its display name, resolve it to keys via the grep procedure below — don't
guess a key from the display name (see the FormSG example below for why that's unsafe).

## Procedure

1. **App key**: the directory name under `packages/backend/src/apps/<app-key>/` — this is also the
   value of the top-level `key:` field in `packages/backend/src/apps/<app-key>/index.ts`. The
   display name is that same file's top-level `name:` field.

   ```ts
   // packages/backend/src/apps/gathersg/index.ts
   name: 'Ownself Gather',
   key: 'gathersg',
   ```

   The directory/key doesn't always resemble the display name — `gathersg` displays as
   "Ownself Gather," not "GatherSG." Always read the `name:` field; never infer the app key by
   abbreviating or transliterating the display name.

2. **Trigger/action key**: grep `name:` and `key:` inside
   `packages/backend/src/apps/<app-key>/triggers/<trigger-dir>/index.ts` or
   `packages/backend/src/apps/<app-key>/actions/<action-dir>/index.ts`.

   ```ts
   // packages/backend/src/apps/slack/actions/send-a-message-to-channel/index.ts
   name: 'Send a message to channel',
   key: 'sendMessageToChannel',
   ```

   The kebab-case directory name does not necessarily match the camelCase `key:` value inside
   (`send-a-message-to-channel` → `sendMessageToChannel`). Read the `key:` field itself — don't infer
   it from the directory name.

3. **`steps.type`** is the literal string `'trigger'` or `'action'` — not the trigger's own optional
   `type` field some app definitions have (e.g. FormSG/GatherSG triggers have their own
   `type: 'webhook'` field, which is an unrelated trigger-subtype flag, not the `steps.type` column
   value).

## Deviations to watch for when grepping

- **Flat-file triggers/actions**: most apps put each trigger/action in its own
  `<key-dir>/index.ts`, but at least one app (`databricks`) stores an action directly as
  `actions/create-row.ts` with no subdirectory. If grepping `actions/*/index.ts` /
  `triggers/*/index.ts` turns up nothing for an app, also check for loose `actions/*.ts` /
  `triggers/*.ts` files.
- **Non-trigger/action helper files**: a `triggers/` or `actions/` directory can contain a helper file
  that isn't itself a trigger/action (e.g. `scheduler/triggers/get-data-out-metadata.ts`). Confirm a
  candidate file actually exports an object with its own `key:`/`name:` fields before treating it as a
  resolvable trigger/action.
- **Apps with only one of triggers/actions**: normal, not a deviation — e.g. `webhook` has only
  `triggers/`, `slack` (at time of writing) has only `actions/`.
- **Display-name collisions across type**: two entries can share a display name. FormSG's trigger
  `newSubmission` and its hidden action `mrfSubmission` are both labeled "New form response" in code
  (the action is a hidden MRF-continuation step, `hiddenFromUser: true`, not shown in the builder UI).
  Resolving by display-name text search alone is ambiguous here — always resolve to the
  `(app_key, type, key)` triple before writing SQL, and if a display name doesn't uniquely determine
  `type`, grep both `triggers/` and `actions/` and disambiguate using the question's own phrasing
  ("the FormSG trigger" vs. "the FormSG action").

## Starter table (confirm via grep — don't treat as exhaustive or stale-proof)

| App display name | `app_key` | Trigger/action display name | `key` | `type` |
|---|---|---|---|---|
| FormSG | `formsg` | New form response | `newSubmission` | trigger |
| FormSG | `formsg` | New form response (hidden MRF continuation) | `mrfSubmission` | action |
| Ownself Gather | `gathersg` | New instant workflow | `newInstantWorkflow` | trigger |
| Ownself Gather | `gathersg` | Create case | `createCase` | action |

This table is a starting point for the most commonly-referenced apps, not a substitute for grepping —
apps get added/renamed over time, so always confirm against the current source in
[packages/backend/src/apps/](../../../../packages/backend/src/apps/) before finalizing a query, per
the procedure above.
