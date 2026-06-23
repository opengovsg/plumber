# Plumber — Windows Local Dev Onboarding

## Prerequisites

- Node.js 22
- Docker Desktop with **WSL2 backend** enabled (Settings → General → "Use the WSL 2 based engine")
- Git

## First-time setup

### 1. Install dependencies

Set the BullMQ Pro token **before** running `npm install`. Get a free trial token from [taskforce.sh](https://taskforce.sh/):

```powershell
$env:NPM_TASKFORCESH_TOKEN = "<your-token>"
npm install
```

### 2. Configure environment

```powershell
copy packages\backend\.env-example packages\backend\.env
```

Then open `packages/backend/.env` and change these values:

```
# Required — "..." is not a valid URL and crashes the server at startup
PAIR_ROME_BASE_URL=http://localhost

# Must match the docker-compose.dev.yml MinIO credentials
S3_ACCESS_KEY=minio-username
S3_SECRET_KEY=minio-password
```

### 3. Start Docker services

```powershell
docker compose -f packages/backend/docker-compose.dev.yml up -d
```

> Use `docker compose` (no hyphen) — newer Docker Desktop dropped the standalone `docker-compose` command.
> If port 6379 (Redis) is blocked, make sure the WSL2 backend is enabled in Docker Desktop settings.

### 4. Run DB migrations (first time only)

`npm run migrate` does not work on Windows because it uses Unix-style env var syntax. Run directly:

```powershell
cd packages/backend
$env:DOTENV_CONFIG_PATH=".env"; npx knex migrate:latest
cd ../..
```

### 5. Start the app

```powershell
npm run dev
```

- Frontend: http://localhost:3001
- Backend: http://localhost:3000

## Logging in

The app uses OTP email login, but in local dev the OTP is printed to the terminal instead of being sent:

1. Go to http://localhost:3001
2. Enter `admin@example.gov.sg` (from `ADMIN_USER_EMAIL` in your `.env`)
3. Watch the `[backend]` terminal output — the OTP appears there in highlighted text
4. Enter the OTP in the browser

`.gov.sg` emails are always allowed; other emails must be in the login whitelist table.

## Daily dev loop

After every computer restart, Docker containers stop and must be restarted before `npm run dev`.

```powershell
# Start Docker services (run this after every computer restart)
npm run setup

# Start the app
npm run dev
```

`npm run setup` is equivalent to `docker compose -f packages/backend/docker-compose.dev.yml up -d` but works from the project root.

Frontend hot-reloads on changes. Backend requires a terminal restart (or press `rs` + Enter in the dev terminal) after server-side changes.

## Running tests

```powershell
# Single unit test file
npx vitest packages/backend/src/helpers/__tests__/<file>.test.ts

# All backend unit tests
npm run -w backend test:unit
```

## Hello World: smoke-test your setup

A minimal working flow that triggers on demand, waits a fixed time, then sends a Telegram message. Use this to verify your local setup is working end-to-end.

### Flow steps

| #   | Type    | App      | What it does                              |
| --- | ------- | -------- | ----------------------------------------- |
| 1   | Trigger | Webhook  | Starts the flow when an HTTP POST arrives |
| 2   | Action  | Delay    | Waits a fixed duration before continuing  |
| 3   | Action  | Telegram | Sends a message to a chat/topic           |

### Setting it up in the editor

1. Go to `http://localhost:3001` and log in
2. Create a new pipe → add **Webhook** as the trigger
3. Add step → **Delay** → choose unit (minutes/hours/days/weeks) and value
4. Add step → **Telegram** → connect your bot, set chat ID and message text
5. In the message text field, you can reference webhook data with the variable picker:
   - e.g. `Hello, {{1.message}}` inserts the `message` field from the webhook payload
6. Click **Publish**

### Triggering the flow

> The URL provided in the editor points to the production domain. To test locally, replace the domain with `http://localhost:3000` — the flow ID in the path remains the same. This sends the request directly to your local backend, bypassing the Cloudflare tunnel.

```powershell
# Empty trigger
Invoke-WebRequest -Method POST `
  -Uri "http://localhost:3000/webhooks/<flow-id>" `
  -ContentType "application/json" `
  -Body '{}'

# With payload data (usable in later steps via {{1.fieldName}})
Invoke-WebRequest -Method POST `
  -Uri "http://localhost:3000/webhooks/<flow-id>" `
  -ContentType "application/json" `
  -Body '{"message": "Good morning!"}'
```

A `200 OK` response means the flow was accepted and is now running.

### Checking execution

- Go to the **Executions** tab (clock icon in the editor top nav)
- Each execution shows Data In / Data Out per step
- The Delay step shows `delayForUnit` and `delayForValue` in its Data Out
- The Telegram step shows the final rendered message text

### How the delay works in code

`delayForValue` + `delayForUnit` → milliseconds via `packages/backend/src/helpers/delay-for-as-milliseconds.ts`, then passed to BullMQ as the step delay. Units: minutes × 60 000, hours × 3 600 000, days × 86 400 000, weeks × 604 800 000.

### Troubleshooting

| Problem                                                             | Cause                                      | Fix                                                                             |
| ------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------- |
| Telegram message contains variable name (e.g. `Hello Worldminutes`) | Wrong variable referenced in message field | Open the step, remove the incorrect variable badge, re-add the correct one      |
| `200 OK` but nothing happens                                        | Flow is not published                      | Click **Publish** in the editor                                                 |
| Scheduler trigger fires too slowly for testing                      | Minimum interval is 1 hour                 | Swap to Webhook trigger during development; restore scheduler before going live |

## Known Windows issues

| Issue                                    | Fix                                                                             |
| ---------------------------------------- | ------------------------------------------------------------------------------- |
| `'DOTENV_CONFIG_PATH' is not recognized` | Use `$env:VAR=value; command` syntax in PowerShell instead of `npm run migrate` |
| `401 Unauthorized` from taskforce.sh     | Set `NPM_TASKFORCESH_TOKEN` env var before `npm install`                        |
| Port 6379 bind error                     | Enable WSL2 backend in Docker Desktop settings                                  |
| `docker-compose` not found               | Use `docker compose` (space, no hyphen)                                         |
| LaunchDarkly 401 warnings in logs        | Harmless in local dev — feature flags just won't work                           |
