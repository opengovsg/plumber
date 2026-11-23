# Drive the Plumber UI

Any agent can follow these steps. Each step needs only a shell and a browser tool.

The app runs on `.env-example` placeholders. Calls to FormSG, M365, Postman, Databricks, sgID and SSO fail. That is expected.

## 1. Set up the worktree

Run the setup script once per worktree. Most worktree tools run it on create.

```sh
bash scripts/worktree-setup.sh
```

It installs dependencies, starts the shared Docker services and migrates the local database. If it says Docker is not running, ask the user to start Docker.

Do not run `pnpm run setup` or `pnpm run dev`. Both need 1Password.

## 2. Start the dev server

Run the server in the background and write its output to a log file:

```sh
LOG="$(git rev-parse --git-path plumber-dev.log)"
nvm use && pnpm run dev:sample-env > "$LOG" 2>&1 &
```

The log sits in this worktree's git directory, so it never shows up in `git status`. If your tool has visible terminals, run the same command there with `2>&1 | tee "$LOG"`.

The server is ready when Vite's `Local:` line shows this worktree's frontend URL:

```sh
grep -a "Local:" "$LOG" | sed 's/\x1b\[[0-9;]*m//g'
```

If a server for this worktree is already running, reuse it.

The backend rebuilds on change, and the frontend hot-reloads. If the page goes blank after a rebuild, load the URL again.

## 3. Log in

1. Pick a new email for this run, e.g. `agent-$(date +%s)@open.gov.sg`. A new user has no pipes. Only `.gov.sg` addresses pass.
2. Open `<frontend>/login`. Fill the email field and choose `Get OTP`.
3. Read the OTP from the log. The backend prints it instead of sending an email.

   ```sh
   grep -a "OTP for <email>" "$(git rev-parse --git-path plumber-dev.log)" | tail -1 | sed 's/\x1b\[[0-9;]*m//g'
   ```

4. Fill the field labelled `Enter OTP sent to <email>` and choose `Verify OTP`.
5. Wait for the URL to reach `/flows`. A first login shows an announcement dialog. Close it.

Requesting a second OTP within 30 seconds fails. Five wrong OTPs lock the user.

## 4. Drive the UI

Use your tool's browser, e.g. Orca's built-in browser, chrome-devtools MCP or Playwright MCP. Without one, write a Playwright script with `packages/e2e`'s `@playwright/test`.

- Find controls by role and accessible name. Use placeholder or visible text when a control has no name.
- Keep the window at least 1280 px wide. Narrower windows hide the sidebar labels.
- Follow the matching page in [features/](./features/README.md) for screens, expected results and traps.

## 5. Prove the result

- Capture the action and the resulting state, not only the final screen.
- For UI, save an accessibility snapshot and a screenshot.
- For a change that saves data, reload the page and show the saved value.

## 6. Clean up

Stop the dev server when you finish. Leave the Docker containers running.

All worktrees share one Postgres and one Redis. Other worktrees see the data you create. A running worker may pick up another worktree's queued jobs.

The backend's LaunchDarkly client runs offline, so backend flags use their code fallback values. The frontend still reads real flags from the LaunchDarkly dev environment.
