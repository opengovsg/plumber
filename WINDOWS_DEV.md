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

## Known Windows issues

| Issue                                    | Fix                                                                             |
| ---------------------------------------- | ------------------------------------------------------------------------------- |
| `'DOTENV_CONFIG_PATH' is not recognized` | Use `$env:VAR=value; command` syntax in PowerShell instead of `npm run migrate` |
| `401 Unauthorized` from taskforce.sh     | Set `NPM_TASKFORCESH_TOKEN` env var before `npm install`                        |
| Port 6379 bind error                     | Enable WSL2 backend in Docker Desktop settings                                  |
| `docker-compose` not found               | Use `docker compose` (space, no hyphen)                                         |
| LaunchDarkly 401 warnings in logs        | Harmless in local dev — feature flags just won't work                           |
