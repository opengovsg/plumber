# Resolving app, trigger and action names

`steps.app_key`, `steps.key` and `steps.type` store opaque strings, e.g.
`'slack'`, `'sendMessageToChannel'` and `'action'`. Display names exist only in
code, under [packages/backend/src/apps/](../../../packages/backend/src/apps/).
Resolve every display name with the procedure below. Never guess a key from a
display name.

## Procedure

1. **App key.** The directory name `packages/backend/src/apps/<app-key>/`. It
   matches the top-level `key:` in that directory's `index.ts`. The display name
   is the top-level `name:` in the same file.

   ```ts
   // packages/backend/src/apps/gathersg/index.ts
   name: 'Ownself Gather',
   key: 'gathersg',
   ```

   The key can differ from the display name. `gathersg` displays as "Ownself
   Gather".

2. **Trigger or action key.** Read `name:` and `key:` in
   `apps/<app-key>/triggers/<dir>/index.ts` or
   `apps/<app-key>/actions/<dir>/index.ts`.

   ```ts
   // packages/backend/src/apps/slack/actions/send-a-message-to-channel/index.ts
   name: 'Send a message to channel',
   key: 'sendMessageToChannel',
   ```

   The kebab-case directory name does not always match the camelCase `key:`.
   Read the `key:` field.

3. **`steps.type`** is `'trigger'` or `'action'`. Some trigger definitions have
   their own `type` field, e.g. FormSG's `type: 'webhook'`. That is a different
   field.

## Deviations

- **Flat files.** Some apps store a trigger or action as a loose file, e.g.
  `databricks/actions/create-row.ts`. If `*/index.ts` finds nothing, check
  `actions/*.ts` and `triggers/*.ts`.
- **Helper files.** A `triggers/` or `actions/` directory can hold helpers, e.g.
  `scheduler/triggers/get-data-out-metadata.ts`. Confirm a file exports its own
  `key:` and `name:`.
- **Apps with only triggers or only actions.** Normal. `webhook` has only
  `triggers/`.
- **Shared display names.** FormSG's trigger `newSubmission` and its hidden
  action `mrfSubmission` are both "New form response". Resolve to the full
  `(app_key, type, key)` triple. Use the question's wording ("the FormSG
  trigger") to pick one, and ask if it does not settle it.

## Common keys

Confirm against the code before use. The list is not exhaustive.

| App display name | `app_key`  | Trigger or action display name              | `key`                | `type`  |
| ---------------- | ---------- | ------------------------------------------- | -------------------- | ------- |
| FormSG           | `formsg`   | New form response                           | `newSubmission`      | trigger |
| FormSG           | `formsg`   | New form response (hidden MRF continuation) | `mrfSubmission`      | action  |
| Ownself Gather   | `gathersg` | New instant workflow                        | `newInstantWorkflow` | trigger |
| Ownself Gather   | `gathersg` | Create case                                 | `createCase`         | action  |
| Email by Postman | `postman`  | Send email                                  | `sendTransactionalEmail` | action  |
