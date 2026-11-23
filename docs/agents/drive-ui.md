# Drive the Plumber UI

Any agent can follow these steps. Each step needs only a shell and a browser tool.

The app runs on `.env-example` placeholders. Calls to FormSG, M365, Postman, Databricks, sgID and SSO fail. That is expected.

## Before you start

- Work in a linked worktree, never the main checkout. The main checkout's ports 3000 and 3001 belong to the user's `pnpm run dev`.

  ```sh
  [ "$(git rev-parse --git-dir)" != "$(git rev-parse --git-common-dir)" ] && echo linked || echo "main checkout: stop"
  ```

- All worktrees share one Postgres and one Redis.
  - Other worktrees see the data you create.
  - Your worker may run another worktree's queued jobs.
  - If another branch added a migration your branch lacks, setup fails on that migration. Ask the user before you go on.
- Your shell must be able to write this worktree's git metadata, under the main checkout's `.git/worktrees/`. The first dev server start records this worktree's ports there.
- Shell variables do not survive between tool calls. Each command below works on its own. Run every command from the worktree root.

## 1. Set up the worktree

Run the setup script once per worktree. It may already have run if the user set it as their worktree setup command.

```sh
bash scripts/worktree-setup.sh
```

It installs dependencies, starts the shared Docker services and migrates the shared database. If it says Docker is not running, ask the user to start Docker. Then run it again.

Do not run `pnpm run setup` or `pnpm run dev`. Both need 1Password.

## 2. Start the dev server

Check whether your own server is already running. Reuse it if this prints `running`.

```sh
[ -f tmp/plumber-dev.pid ] && kill -0 "$(cat tmp/plumber-dev.pid)" 2>/dev/null && echo running
```

Otherwise check that nothing else holds this worktree's frontend port. A file in git metadata records the ports after the first start. Stop and ask the user if this prints `in use`.

```sh
f="$(git rev-parse --git-path plumber-port)"; [ -f "$f" ] && node -e 'require("net").connect(+process.argv[1] + 1, "localhost").on("connect", () => { console.log("in use"); process.exit() }).on("error", () => {})' "$(cat "$f")"
```

Start the server in the background. The `tmp/` folder is git-ignored. This runs `pnpm run dev:sample-env` without pnpm, so the saved PID stops the whole server.

```sh
. "${NVM_DIR:-$HOME/.nvm}/nvm.sh" && nvm use >/dev/null && mkdir -p tmp && { node scripts/with-sample-env.mjs node node_modules/turbo/bin/turbo watch dev worker --continue > tmp/plumber-dev.log 2>&1 & echo $! > tmp/plumber-dev.pid; }
```

The server is ready when Vite's `Local:` line shows the frontend URL. Its port must be the recorded port plus 1. If Vite picked another port, stop the server and ask the user.

```sh
grep -a "Local:" tmp/plumber-dev.log | sed 's/\x1b\[[0-9;]*m//g'; echo "expected port $(($(cat "$(git rev-parse --git-path plumber-port)") + 1))"
```

The backend rebuilds on change, and the frontend hot-reloads. If the page goes blank after a rebuild, load the URL again.

## 3. Log in

Use a fresh browser context, such as a new incognito context or a new Playwright context. The session cookie works across every `localhost` port. A shared profile would replace the user's own Plumber session.

1. Pick a new email for this run with a random suffix. A new user has no pipes.

   ```sh
   echo "agent-$(date +%s)-$RANDOM@open.gov.sg"
   ```

2. Open `<frontend>/login`. Fill the email field and choose `Get OTP`.
3. Read the OTP from the log. The backend prints it instead of sending an email. Replace `<email>` with the email from step 1.

   ```sh
   sleep 1; grep -aF "OTP for <email>:" tmp/plumber-dev.log | tail -1 | sed 's/\x1b\[[0-9;]*m//g' | awk '{print $NF}'
   ```

4. Fill the field labelled `Enter OTP sent to <email>` and choose `Verify OTP`.
5. Wait for the URL to leave `/login`. A new user lands on `/flows`. An announcement dialog may appear. Close it if it does.

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

Stop only the server you started. Leave the Docker containers running.

```sh
[ -f tmp/plumber-dev.pid ] && kill "$(cat tmp/plumber-dev.pid)" && rm tmp/plumber-dev.pid
```

The backend's LaunchDarkly client runs offline, so backend flags use their code fallback values. The frontend still reads real flags from the LaunchDarkly dev environment.
