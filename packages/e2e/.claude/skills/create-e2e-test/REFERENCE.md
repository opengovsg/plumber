# packages/e2e reference

Conventions for specs in `packages/e2e`. Where this file and the code disagree, follow the code and tell the user so this file gets fixed.

## Layout

- `tests/*.spec.ts`: Playwright specs. `playwright.config.ts` matches only `*.spec.ts` under `tests/`.
- `utils/`: shared helpers, listed below.
- `data/`: upload files, e.g. `sample-attachment.png`.
- `config.ts`: env-backed constants. `PIPE_IDS`, `BASE_URL`, `AUTH_STATE_FILE`, form IDs, `MAILBOX`, `MAILSENDER`, `WEBHOOK_TESTER_HOSTNAME`.
- `environments.ts`: Zod schema for `E2E_FIXTURE_MANIFEST` and the `staging`/`uat` profile selection.
- `playwright.config.ts` sets `testIdAttribute: 'data-test'`. `getByTestId('x')` matches `data-test="x"`.

## Webhook pipe template

```ts
import { randomUUID } from 'crypto'

import test, { expect } from '@playwright/test'

import { BASE_URL, PIPE_IDS } from '../config'
import { checkWebhook } from '../utils/webhook-check'

const ACTION_WEBHOOK_URL = `${BASE_URL}/webhooks/${PIPE_IDS.<key>}`

test.describe('Action <App>', () => {
  test('<user-visible outcome>', async ({ request }) => {
    const uuid = randomUUID()
    const res = await request.post(ACTION_WEBHOOK_URL, { data: { uuid } })
    expect(res.status()).toBe(200)
    expect(await checkWebhook(uuid, { success: true })).toBe(true)
  })
})
```

The pipe's final step posts its result to `${WEBHOOK_TESTER_HOSTNAME}/<uuid>`. `checkWebhook` reads it after one second. For pipes with delays, split trigger and check into two tests under `test.describe.serial`. See `action-slack.spec.ts`. For email actions, assert with `checkGmail` and put the UUID in the subject. See `action-postman.spec.ts`.

## Browser UI flow template

```ts
import { readFileSync } from 'fs'

import { expect, type Page, test } from '@playwright/test'
import Cryptr from 'cryptr'

import {
  AUTH_FILE_ENCRYPTION_SECRET,
  AUTH_STATE_FILE,
  BASE_URL,
} from '../config'

let page: Page

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage({
    baseURL: BASE_URL,
    storageState: JSON.parse(
      new Cryptr(AUTH_FILE_ENCRYPTION_SECRET).decrypt(
        readFileSync(AUTH_STATE_FILE).toString(),
      ),
    ),
  })
})

test.describe.serial('<Feature>', () => {
  test('<user-visible outcome>', async () => {
    await page.goto('/flows')
    await page.getByTestId('create-flow-button').click()
  })
})
```

Steps share one `page`, so use `test.describe.serial`. Build editor paths from `PIPE_IDS`, e.g. `` `/editor/${PIPE_IDS.editor}` ``. A spec that creates pipes, tiles or connections names them with `randomUUID()` so parallel runs never collide.

## Helpers in `utils/`

- `waitForAnimationEnd(locator)`: await after opening drawers, modals or steps. Chakra animations cause flaky clicks otherwise.
- `getPopperFor(parent, index)`: nth Chakra popover in the portal.
- `richTextType(editor, value, titleToClickAway?)`: fill a rich-text field, then click the title to close the variable popper.
- `closeAnnouncementModal(page)`: dismiss the announcement modal when a release adds one.
- `checkGmail({ from, to, subject, includeAttachments, retrieveSince })`: polls the `MAILBOX` inbox for up to 60 seconds.
- `checkWebhook(uuid, expected)` / `fetchKeyValue(uuid)`: read what the pipe posted to the webhook tester.
- `utils/timezone` default export: `dayjs.tz` fixed to `Asia/Singapore`. Use it for any date a pipe parses.

## Selector rules

1. `getByTestId` first.
2. `getByRole` with an accessible name second.
3. Text and CSS selectors last, on stable attributes only. Chakra class names change between builds.
4. Chakra modals and popovers render under `div.chakra-portal`. Scope locators to it.
5. Use `{ force: true }` only on elements that animate forever. Add a `// NOTE:` saying why.

## Adding a `data-test` attribute

- kebab-case, scoped by feature: `ai-builder-send-button`, not `button1`.
- Put it on the interactive element itself. For assertion-only text, put it on the text element.
- Shared components: add an optional `testId` prop that passes through to `data-test`.
- Never rename an existing `data-test` value. Grep `packages/e2e/tests` for it first.

## Flakiness rules

- Wait on web-first assertions such as `expect(...).toBeVisible()`, not `page.waitForTimeout`.
- Assert on the payload's `randomUUID()` so parallel workers never read each other's results.
- For non-deterministic output (AI Builder), assert a stable signal plus the text that separates success, empty and error states.
- Pass a longer `timeout` only to the single slow assertion, with a comment saying why.

## Register a fixture key

Pipe keys are camelCase, e.g. `lettersgCreate`. Form keys hold 24-character FormSG IDs.

1. `environments.ts`: add the key to `fixtureProfileSchema`. Pipes use `z.string().uuid()`. Forms use the existing 24-hex regex. `scripts/mask-fixtures.ts` masks only these two formats in CI logs.
2. `fixture-manifest.example.json`: add the key to both `staging` and `uat` with synthetic IDs. Take the next unused number in that profile's range. Staging pipes use `00000000-0000-4000-8000-0000000001NN`, UAT pipes `...2NN`. Forms follow the same pattern in 24 hex digits.
3. `environments.test.ts`: bump the pipe or form count assertions.
4. `README.md`: bump the pipe and form key counts.
5. Forms only: export a constant from `config.ts` as `process.env.<NAME>_FORM_ID || environment.forms.<key>`.

## Fixture request

Open with a one-line count, e.g. "1 pipe needed on staging and UAT". Then one numbered recipe per fixture:

1. **Where**: `https://staging.plumber.gov.sg`, then `https://uat.plumber.gov.sg`, signed in as `internal-testing@open.gov.sg`.
2. **Start from**: duplicate an existing `E2E -` pipe with the same step shape, so the final webhook-tester step comes along. List the steps to delete.
3. **Name**: `E2E - <App> <purpose>`.
4. **Steps**: in order, with app, event and every field value. Take labels from the action's `arguments` in `packages/backend/src/apps/<app>/actions/<action>/`. Name trigger variables by payload key, e.g. "the webhook's `uuid` field".
5. **Final step**: keep the webhook-tester step. Change only its body to the keys the spec asserts on.
6. **Publish** the pipe.
7. **Smoke test**: the user runs this, with the literal `WEBHOOK_TESTER_HOSTNAME` default from `environments.ts`. State the JSON keys it must print.
   ```bash
   curl -s -X POST <base-url>/webhooks/<pipe-id> -H 'content-type: application/json' -d '{"uuid":"smoke-1"}' && sleep 5 && curl -s <webhook-tester-hostname>/smoke-1
   ```
8. **Update every manifest copy** with the new key under both profiles:
   - The shared `e2e` 1Password Environment, field `E2E_FIXTURE_MANIFEST`, as compact JSON.
   - The `E2E_FIXTURE_MANIFEST` Actions secret on the repository, and on each GitHub environment that overrides it (`staging`, `uat`, `production`). An environment secret holds only its own profile. `production` holds the staging profile.
   - The populated manifest in the trusted Notion consolidation document.
9. **Reply**: "done", without the IDs.

A form fixture replaces steps 2 to 7 with: the FormSG fields (label and type), settings to change (disable CAPTCHA), and the Plumber connection to add.
