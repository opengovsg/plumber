# Drive the Plumber UI

Any agent can follow these steps. Each step needs only a shell and a browser tool.

The app runs on `.env-example` placeholders. Calls to FormSG, M365, Postman, Databricks, sgID and SSO fail. That is expected.

## Before you start

- Work in a linked worktree, never the main checkout. The main checkout's ports 3000 and 3001 belong to the user's `pnpm run dev`. The server script refuses to run there.
- All worktrees share one Postgres and one Redis.
  - Other worktrees see the data you create.
  - Your worker may run another worktree's queued jobs.
  - If another branch added a migration your branch lacks, setup fails on that migration. Ask the user before you go on.
- Your shell must be able to write this worktree's git metadata, under the main checkout's `.git/worktrees/`. The first server start records this worktree's ports there.
- Run every command from the worktree root. Each one works from a fresh shell.
- Node comes from nvm. If `node -v` does not match `.nvmrc`, prefix each command with `. "${NVM_DIR:-$HOME/.nvm}/nvm.sh" && nvm use >/dev/null &&`.

## 1. Set up the worktree

Run the setup script once per worktree. It may already have run if the user set it as their worktree setup command.

```sh
bash scripts/worktree-setup.sh
```

It installs dependencies, starts the shared Docker services and migrates the shared database. If it says Docker is not running, ask the user to start Docker. Then run it again.

Do not run `pnpm run setup` or `pnpm run dev`. Both need 1Password.

## 2. Start the dev server

```sh
node scripts/sample-dev-server.mjs start
```

It prints the backend and frontend URLs once both are ready. If this worktree's server already runs, it waits for it to be ready, then prints `already running` and the same URLs. `status` prints `running`, `starting` or `not running`.

It refuses to start when another process holds this worktree's ports. Ask the user before you stop that process.

The log is in `tmp/plumber-dev.log`, which git ignores. The backend rebuilds on change, and the frontend hot-reloads. If the page goes blank after a rebuild, load the URL again.

## 3. Log in

Use a fresh browser context, such as a new incognito context or a new Playwright context. The session cookie works across every `localhost` port. A shared profile would replace the user's own Plumber session.

1. Create a new email for this run. A new user has no pipes.

   ```sh
   node scripts/sample-dev-server.mjs email
   ```

2. Open `<frontend>/login`. Fill the email field and choose `Get OTP`.
3. Read the OTP. The backend prints it to the log instead of sending an email. Use the email from step 1.

   ```sh
   node scripts/sample-dev-server.mjs otp "agent-1a2b3c4d5e6f@open.gov.sg"
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

Stop the server you started. Leave the Docker containers running.

```sh
node scripts/sample-dev-server.mjs stop
```

It stops only a server this script started in this worktree. If the ports stay in use afterwards, it exits 1. Ask the user then.

The backend's LaunchDarkly client runs offline, so backend flags use their code fallback values. The frontend still reads real flags from the LaunchDarkly dev environment.
