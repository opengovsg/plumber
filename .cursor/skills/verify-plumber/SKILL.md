---
name: verify-plumber
description: Drive the Plumber web app the way a user does and capture proof. Use when a change touches the landing page, sign-in, pipes, templates, or executions.
---

# Verify Plumber

Plumber's user surface is the web app. This skill launches a disposable copy, drives it in Chrome, and leaves screenshots and ARIA snapshots. Do not use `pnpm run dev` or `pnpm run setup`. Both ask 1Password for secrets.

The helper is `.cursor/skills/verify-plumber/scripts/control-plumber`. Run it from the repo root after `nvm use`.

## Launch

Start one disposable instance. `pnpm install` must already have succeeded, including `@taskforcesh/bullmq-pro` from `npm.taskforce.sh`.

```bash
nvm use && .cursor/skills/verify-plumber/scripts/control-plumber launch
```

Launch pulls `postgres:14-alpine` and `redis:6.2.0-alpine`, migrates an empty database, and starts the backend, Vite, and headless Chrome on free ports. If those image pulls fail, it starts local Postgres and Redis with the same user, password, and database name, and doctor prints `engine local`. It prints the frontend URL and a fresh `.gov.sg` email. The database lives only in the `plumber-verify-pg` container.

Ready means the frontend shell is served and GraphQL `healthcheck` returns a version. A database port that accepts connections is not ready.

One instance at a time. A second `launch` refuses while `state.json` exists. Do not drive a server you did not start, including a human session on ports 3000 and 3001.

This launch does not start the worker, tiles Postgres, DynamoDB, MinIO, or the Cloudflare tunnel. Journeys that publish a pipe, upload a file, or open Tiles fail that precondition. Report the gap. Do not point the browser at the human's stack to skip it.

`dev:sample-env` cannot sign in to FormSG, M365, Postman, Databricks, sgID, or one.gov.sg. Email OTP is the sign-in path. In development the backend prints the OTP in its log. The harness reads that line.

## Doctor

```bash
nvm use && .cursor/skills/verify-plumber/scripts/control-plumber doctor
```

Doctor checks the backend, frontend, and Chrome pids, the Postgres container, the frontend shell, and the GraphQL version. Continue only when it prints `healthy` and the URL from this launch.

## Drive

Read `features/README.md`, then follow one feature file. Commands are literal.

```bash
nvm use && .cursor/skills/verify-plumber/scripts/control-plumber browser goto /login
nvm use && .cursor/skills/verify-plumber/scripts/control-plumber browser click --role button --name "Get OTP"
nvm use && .cursor/skills/verify-plumber/scripts/control-plumber browser fill --placeholder "ABC123" --value "$(.cursor/skills/verify-plumber/scripts/control-plumber otp)"
```

`browser` talks to the Chrome instance from `launch`. Prefer role and accessible name. Use placeholder or visible text when the control has no accessible name. The window is 1280 by 900 so the sidebar labels are visible.

`otp` prints the latest code for this run's email. `email` prints that address. `url` prints the frontend origin. Open that origin only.

## Evidence

Save proof under the artifacts directory doctor prints. Default is `/tmp/plumber-verify/artifacts`.

Capture the action and the resulting state. A screenshot of the last screen is not enough. UI proof is an ARIA snapshot plus a screenshot that shows the Plumber page. Mutation proof also reloads the page and shows the saved value again.

Record the feature id and the entry point in the notes next to the artifacts.

## Cleanup

```bash
nvm use && .cursor/skills/verify-plumber/scripts/control-plumber cleanup
```

Cleanup kills the processes this launch started and removes the Postgres and Redis containers. It leaves the artifacts directory in place. Run it after a failed attempt too, so the next launch is not blocked.

After cleanup, confirm the proof files still exist. A cleanup that deletes them is a failed run.
