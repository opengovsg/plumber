# Share UI evidence on a PR

Record browser evidence for a PR that changes what users see. Then link it on the PR, so reviewers can check the change without running it.

Any agent can follow these steps. Start the app and log in with [Drive the Plumber UI](./drive-ui.md) first.

## When to record

- Record evidence when the PR changes a page, dialog, form or other UI a user reaches.
- Skip it for backend-only, docs-only and test-only PRs. Name the tests in the PR instead.
- Record again after a push that changes the recorded behavior. Update the existing comment and page in place, and name the latest tested commit.

## 1. Plan the scenarios

Write one scenario per behavior the PR claims. Take them from the PR description, its test plan and its review threads. For each scenario, note:

- the entry point, e.g. Pipes page, then `+`, then "Use a template"
- the expected result
- any setup it needs, e.g. a published pipe or a second user

Include the regression paths the PR touches, not only the new feature. List each scenario you cannot reach, with the reason.

## 2. Record

Use your tool's browser if it can record video. Otherwise write a Playwright script.

- Save it as `packages/e2e/tmp/<name>.mjs`. Only `packages/e2e` can import `@playwright/test`, and git ignores `tmp/`.
- Run it from the repo root with `node packages/e2e/tmp/<name>.mjs`, so its `tmp/qa/` paths land in the root `tmp/`.
- If Chromium is missing, run `pnpm --filter e2e exec playwright install chromium`.

```js
import { chromium } from '@playwright/test'

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 2,
  recordVideo: { dir: 'tmp/qa/video', size: { width: 1280, height: 800 } },
})
const page = await context.newPage()
// Drive one scenario. Screenshot each action and its result.
await page.screenshot({ path: 'tmp/qa/2667-discard-1-dialog.png' })
await context.close() // Playwright writes the video on close.
await page.video().saveAs('tmp/qa/2667-discard.webm')
await browser.close()
```

- Record one video per scenario, so each one shows a single behavior.
- Take a screenshot of the action and one of the result.
- Name files `<pr>-<scenario>-<step>.<ext>`, e.g. `2667-discard-1-dialog.png`.
- For a change that saves data, reload the page and capture the saved value.
- To show a pending state, delay the request with `page.route`. For example, hold the `UpdateStep` mutation for 4 seconds, then try Esc and an outside click.
- Check what was saved by reading the local database, e.g. `docker exec backend-postgres-1 psql -U postgres -d plumber_dev`. Put the result in the PR comment.

## 3. Keep the files out of git

- Save all media under `tmp/qa/`. Git ignores `tmp/`.
- Never commit screenshots or videos, and never push them to a branch or a release.
- Before you commit anything else, run `git status` and confirm it lists no media.

## 4. Share it on the PR

Post one PR comment with the following. On a re-run, edit that comment instead of adding a new one.

- a link to the media, or the files attached to the comment
- the commit the recordings used
- one line per scenario saying what it shows
- every scenario you did not cover, with the reason

How you attach the media depends on your tool:

- **Claude Code**: follow the `share-pr-evidence` skill. It publishes a private page with the media and links it from the PR.
- **Other agents**: GitHub's API cannot upload comment attachments. Give the user the file paths and the comment text. The user drags the files into the PR comment on github.com.

Never paste media into a public host. Recordings can show pipe names, emails and form data.

## Gotchas

- Wait for `load`, not `networkidle`. The app keeps polling, so `networkidle` never fires.
- `dev:sample-env` cannot reach FormSG, Postman, M365, Databricks, sgID, SSO or the AI services. Report those scenarios as not covered. Do not fake them.
- A pipe cannot be published on placeholders, because its FormSG trigger cannot connect. To test a published pipe, set `flows.active` to `true` in the local database. Also set its steps' `status` to `completed`, as a real published pipe has.
- A fresh user sees an announcement dialog. Close it before the first scenario.
