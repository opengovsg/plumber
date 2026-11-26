# Share UI evidence on a PR

Record browser evidence for a PR that changes what users see. Then post it on the PR, so reviewers can check the change without running it.

Any agent can follow these steps. Start the app and log in with [Drive the Plumber UI](./drive-ui.md) first.

## When to record

- Record evidence when the PR changes a page, dialog, form or other UI a user reaches.
- For a backend change behind a flow users can reach, record a regression click-through of that flow. For example, a new mutation that the editor calls.
- Skip it when no user-reachable flow changes, e.g. docs-only, test-only or internal tooling PRs. Name the tests in the PR instead.
- Record again after a push that changes the recorded behavior. See [Keep it current](#keep-it-current).

## 1. Check that you can post

Check this before you record, so a slow capture is never wasted.

```sh
gh --version
gh api repos/opengovsg/plumber --jq .permissions.push
```

- **gh 2.99.0 or later, and `true`**: post with `--attach`. GitHub hosts the media and plays videos inline.
- **gh older than 2.99.0**: ask the developer to upgrade `gh`, e.g. `brew upgrade gh`, then check again. Do not upgrade it yourself.
- **The developer cannot upgrade, or push access is `false`, in Claude Code**: follow the `share-pr-evidence` skill. It publishes a private page with the media and links it from the PR.
- **Otherwise**: hand the files and the evidence text to the user. The user drags the files into the PR on github.com.

## 2. Plan the scenarios

Take one scenario per behavior the PR claims, from its description, test plan, review threads and diff. Write them as a table:

| Scenario | Entry point    | Action                                                | Expected result                             | Media                 |
| -------- | -------------- | ----------------------------------------------------- | ------------------------------------------- | --------------------- |
| Discard  | Editor, step 2 | Edit the subject, open step 1, choose Discard changes | Step 1 opens. Step 2 keeps the old subject. | Video + 2 screenshots |

- Cover the empty, error, loading and slow states the PR touches.
- Cover the regression paths, not only the new feature.
- For a visual change, add a **before** capture from the base branch. Run it in a second worktree with the same scenario and file names.
- List each scenario you cannot reach, with the reason.

Show the table to the user and wait for approval before you record. When a coordinating agent planned the scenarios and the user approved them, a worker agent records the approved table without asking again.

## 3. Record

Recordings and screenshots are the evidence. Get them right before anything else.

Use your tool's browser if it can record video. Otherwise write a Playwright script.

- Save it as `packages/e2e/tmp/<name>.mjs`. Only `packages/e2e` can import `@playwright/test`, and git ignores `tmp/`.
- Run it from the repo root with `node packages/e2e/tmp/<name>.mjs`, so its `tmp/qa/` paths land in the root `tmp/`.
- If Chromium is missing, run `pnpm --filter @plumber/e2e exec playwright install chromium`.

```js
import { chromium } from '@playwright/test'

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  recordVideo: { dir: 'tmp/qa/video', size: { width: 1280, height: 800 } },
})
const page = await context.newPage()
const consoleErrors = []
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text())
})
// Drive one scenario. Screenshot each action and its result.
await page.screenshot({ path: 'tmp/qa/2667-discard-1-dialog.png' })
await context.close() // Playwright writes the video on close.
await page.video().saveAs('tmp/qa/2667-discard.webm')
await browser.close()
console.log({ consoleErrors })
```

### Choose the media

- **Video**: for interactive or timing behavior, e.g. a dialog flow, a pending state or a redirect. Record one video per scenario.
- **Screenshot**: for a static change, e.g. copy, layout or a style. Take one of the action and one of the result.
- Attach `.webm`, not GIF. GitHub plays `.webm` inline, and reviewers can scrub it.

### Rules for every capture

- Keep the same 1280 × 800 viewport for every capture, including the before capture.
- Name files `<pr>-<scenario>-<step>.<ext>`, e.g. `2667-discard-1-dialog.png`. A before capture adds `-before`.
- Start each scenario from a known state. Use a new test user or reset the data it changes.
- For a change that saves data, reload the page and capture the saved value.
- Prove the outcome outside the screen too. For example, read the saved row with `docker exec backend-postgres-1 psql -U postgres -d plumber_dev`.
- To show a pending state, delay the request with `page.route`. For example, hold the `UpdateStep` mutation for 4 seconds, then try Esc and an outside click.
- Record console errors per scenario. Report any you find.

### Good to have

- Pace actions for a human viewer. Type with `locator.pressSequentially()` and pause about a second between actions.
- Recent Playwright versions can overlay each action on the video. See `recordVideo` in the Playwright docs.
- Trim the blank first frame if your tool can.

## 4. Keep the files private and out of git

- Save all media under `tmp/qa/`. Git ignores `tmp/`.
- Never commit screenshots or videos, and never push them to a branch or a release.
- Before you commit anything else, run `git status` and confirm it lists no media.
- This repository is public, so media attached to its PRs is public. Record only test users and made-up data.
- Never upload a Playwright trace. A trace holds page contents and network bodies. Keep it under `tmp/` for local debugging.

## 5. Post the evidence

Ask the user where the evidence goes:

- **A PR comment** (default). Post one comment.
- **A `## UI evidence` section in the PR description**. Reviewers read it first.

Start the evidence with the marker line, so later runs can find it.

```md
<!-- pr-evidence -->

**UI evidence** for `<tested commit>` (base `<base commit>`). Local `dev:sample-env`, Chromium, 1280 × 800.

| Scenario | Expected result                             | Status |
| -------- | ------------------------------------------- | ------ |
| Discard  | Step 1 opens. Step 2 keeps the old subject. | Pass   |

**Discard.** Choose Discard changes. The edit is dropped, and step 1 opens.
![Discard dialog](./2667-discard-1-dialog.png)

**Not covered**

- Publish guard. Publish stays disabled, because FormSG cannot connect on placeholders.
```

- Put one or two sentences under each screenshot or video saying what to look at.
- Keep media out of `<details>` blocks. Reviewers skip collapsed content.
- Write the body to `tmp/qa/comment.md`, then post it:

```sh
gh pr comment <pr> --body-file tmp/qa/comment.md --attach tmp/qa/2667-discard.webm --attach tmp/qa/2667-discard-1-dialog.png
```

`gh` rewrites each local path in the body to the uploaded URL. Paths are relative to the body file's folder. It appends attached files the body does not reference.

For the description, read the current body with `gh pr view <pr> --json body --jq .body`. Add or replace the `## UI evidence` section, starting at the marker line. Keep the rest of the description unchanged. Then post it with `gh pr edit <pr> --body-file tmp/qa/body.md` and the same `--attach` flags.

### Keep it current

After a push that changes the recorded behavior, record the changed scenarios again and update the evidence in place:

- In the description, replace the `## UI evidence` section with `gh pr edit`.
- If the evidence comment is still your newest comment on the PR, run the same command with `--edit-last`.
- Otherwise, post a new comment with the marker. Then delete the old marker comment. Never delete first.
- Update the tested commit in the header.

## Gotchas

- Wait for `load`, not `networkidle`. The app keeps polling, so `networkidle` never fires.
- Toasts close after a few seconds. Read their text in the script and report it. Do not rely on a screenshot catching one.
- `dev:sample-env` cannot reach FormSG, Postman, M365, Databricks, sgID, SSO or the AI services. Report those scenarios as not covered. Do not fake them.
- A pipe cannot be published on placeholders, because its FormSG trigger cannot connect. To test a published pipe, set `flows.active` to `true` in the local database. Also set its steps' `status` to `completed`, as a real published pipe has.
- A fresh user sees an announcement dialog. Close it before the first scenario.
- The backend's LaunchDarkly client runs offline, so every backend flag returns its code fallback. PlumPro is the `plumpro` flag with fallback `false`, so PlumPro-only actions such as "Convert to template" return 403. Report a flag-gated scenario as not covered, and name the flag.
