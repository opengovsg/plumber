---
name: create-e2e-test
description: Use when adding a new Playwright E2E spec to packages/e2e, or a fixture (staging or UAT pipe or form) that a spec needs. Also offer it after finishing a user-facing frontend change or a new app trigger or action.
---

# Create an E2E test

Write a Playwright spec in `packages/e2e` that proves a Plumber feature works on a deployed environment.
Templates, helpers and selector rules live in [REFERENCE.md](REFERENCE.md). Read it before step 3.

Guardrails:

- Never commit a real pipe ID, form ID or webhook URL. Specs read IDs from `PIPE_IDS` and form constants in `config.ts`.
- Never read or print `packages/e2e/.env`, `cookie-auth-state-*` or the populated manifest.
- Live runs need the shared `e2e` 1Password Environment. Stop at test discovery and hand the live run to the human.

Copy this checklist and tick items as you go:

```
- [ ] 1. Agree the test plan
- [ ] 2. Add missing data-test attributes
- [ ] 3. Write the spec
- [ ] 4. Register fixtures
- [ ] 5. Verify
- [ ] 6. Request fixtures and secret updates
- [ ] 7. Hand off
```

## 1. Agree the test plan

Read the feature diff and the newest spec of the same kind in `packages/e2e/tests/`. Present to the user:

- **File name**: `action-<app>.spec.ts`, `trigger-<app>.spec.ts` or `misc.<feature>.spec.ts`. Use the backend app key for `<app>`, e.g. `action-m365.spec.ts`.
- **Shape**: pick one per spec.
  - **Webhook pipe**: post a payload with a fresh `randomUUID()` to a pre-built pipe. Assert with `checkWebhook` or `fetchKeyValue` from `utils/webhook-check`, or with `checkGmail` for email actions. Use this for actions.
  - **Browser UI flow**: open a page with the encrypted session in `config.AUTH_STATE_FILE`. Assert on the editor UI. Use this for triggers and editor features.
- One line per `test(...)`, naming the user-visible outcome.
- Each new fixture: pipe or form, its purpose, and the manifest key.

Plan the happy path plus one failure path users have hit before. Leave branch logic to unit and integration tests.
Ask whether the feature is deployed to staging and UAT, and whether any feature flag is on for `internal-testing@open.gov.sg`.

Done when the user approves the plan.

## 2. Add missing data-test attributes

Give each locator target without a unique role and accessible name a `data-test` attribute in `packages/frontend`. Follow the REFERENCE.md naming rules. Run `pnpm --filter frontend run lint:fix`.

Done when every planned locator can use `getByTestId` or `getByRole`.

## 3. Write the spec

Copy the REFERENCE.md template for the chosen shape. Reuse the helpers in `utils/`. Add a helper only when a second spec needs it.

Done when every approved `test(...)` exists.

## 4. Register fixtures

Skip this step if the spec reuses existing fixtures. For each new fixture, follow REFERENCE.md "Register a fixture key". It touches `environments.ts`, `fixture-manifest.example.json`, `environments.test.ts`, the README key counts and, for forms, `config.ts`.

Done when `pnpm --filter @plumber/e2e run test:config` passes.

## 5. Verify

Run from the repository root:

```bash
pnpm --filter @plumber/e2e run lint:fix && pnpm --filter @plumber/e2e run format:fix
```

```bash
pnpm --filter @plumber/e2e run lint && pnpm --filter @plumber/e2e run format && pnpm --filter @plumber/e2e run typecheck && pnpm --filter @plumber/e2e run test:config
```

Then confirm Playwright discovers the spec. `config.ts` throws without Gmail and GatherSG secrets, so pass placeholders and the synthetic manifest:

```bash
E2E_FIXTURE_MANIFEST="$(cat packages/e2e/fixture-manifest.example.json)" GMAIL_CREDENTIALS='{}' GMAIL_TOKEN='{}' GATHERSG_API_KEY=x pnpm --filter @plumber/e2e exec playwright test --list tests/<spec>.spec.ts
```

If `packages/frontend` changed, run `pnpm --filter frontend run lint` and `pnpm --filter frontend run typecheck` too.

Done when every command exits 0 and `--list` prints each new test.

## 6. Request fixtures and secret updates

Skip if step 4 was skipped. Otherwise send one message in the REFERENCE.md "Fixture request" format. The user replies with real IDs privately. Do not write them into any file.

IMPORTANT: the manifest schema requires every key. Update all manifest copies before the change merges, or every E2E run fails at config validation.

Done when the user confirms the fixtures exist on staging and UAT and every manifest copy holds the new keys.

## 7. Hand off

End with one message containing:

1. **Files changed**.
2. **Fixtures**: each pipe or form name, its manifest key, and which manifest copies the user updated.
3. **Run commands** from the repository root:
   ```bash
   pnpm run login:e2e
   ```
   ```bash
   pnpm run test:e2e tests/<spec>.spec.ts
   ```
   For UAT, `export E2E_ENV=uat` and rerun login first. Set `BASE_URL` only to target localhost, after `pnpm run login:e2e:local <plumber.sid cookie>`.
4. **CI**: the spec runs on every staging deploy after merge. Suggest a manual `Plumber E2E` workflow run against UAT.
