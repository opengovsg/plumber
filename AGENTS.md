# AGENTS.md

Plumber is a no-code workflow automation monorepo. See [.claude/CLAUDE.md](.claude/CLAUDE.md) for
architecture, conventions, and the standard dev loop. See [README.md](README.md) for local setup.

## Cursor Cloud specific instructions

These notes cover non-obvious startup and run caveats for this Cloud Agent environment.
The base image already provides Node 22.19.0 (via nvm), npm 11.19.0, and Docker with the
compose plugin. The startup update script runs `npm ci` from the repo root.

### Required secret

`npm ci` needs `NPM_TASKFORCESH_TOKEN`. The `.npmrc` authenticates the private
`@taskforcesh/bullmq-pro` package against `npm.taskforce.sh`. Without this token the install
fails with `401 Unauthorized`. Add it as a Cloud Agent secret.

### Start Docker before bringing up services

The Docker daemon does not auto-start on boot. Start it once per session before `npm run setup`:

```bash
sudo dockerd > /tmp/dockerd.log 2>&1 &
sudo chmod 666 /var/run/docker.sock
```

`docker-compose` is a shim at `/usr/local/bin/docker-compose` that calls `docker compose`.
The npm scripts invoke `docker-compose`, so keep this shim available.

### Infra services

`npm run setup` starts Postgres (5432), tiles-postgres (5431), Redis (6379), MinIO (9000 API,
9001 console), and DynamoDB Local (8000). The `tunnel` service needs `CLOUDFLARE_TOKEN` and is
optional. Local webhooks can POST directly to `http://localhost:3000/webhooks/<flow-id>`.

Run `npm run migrate` once to apply main Postgres migrations. The backend `postsetup` hook
creates the local DynamoDB tile table.

### Run the app

`npm run dev` runs the backend (`:3000`), the BullMQ worker, and the Vite frontend (`:3001`)
together. Vite proxies `/graphql`, `/api`, and `/apps` to `:3000`. Restart `npm run dev` after
backend changes. The frontend hot-reloads on its own.

### Login uses an OTP printed to backend logs

Dev login does not send real email. The one-time password prints in the backend terminal output.
Read it there to complete login. The dev admin email is `admin@example.gov.sg`.

### Node binary note

`node` resolves to `/exec-daemon/node` (22.14.x) while `npm` resolves to the nvm-managed 22.19.0.
This mix works. npm 11.x satisfies the repo's `engine-strict` requirement (`npm >= 11.10.0`).
