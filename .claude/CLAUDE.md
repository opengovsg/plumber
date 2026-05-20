# Introduction

Plumber is a no-code workflow automation tool. Users build "flows" out of triggers and actions provided by integrated "apps" (FormSG, Postman, M365 Excel, Slack, etc.). Flow executions are queued and run by background workers (some flow triggers run on the server).

This uses an npm workspaces monorepo:

- [packages/backend/](../packages/backend/) — server + workers. Scoped rules: [.claude/rules/backend.md](rules/backend.md).
- [packages/frontend/](../packages/frontend/) — React app. Scoped rules: [.claude/rules/frontend.md](rules/frontend.md).
- [packages/types/](../packages/types/) — shared `@plumber/types` (linked via `file:` deps).

## Important top-level commands

Do **not** run these yourself unless the user asks — the human runs the dev server in their own terminal.

**Human dev loop** (for context, so you understand what state the human's environment is in):

- `npm run setup` — one-time per session; brings up Postgres, Redis, DynamoDB, MinIO, etc. via Docker.
- `npm run dev` — runs backend + frontend + worker. The human re-runs / restarts this on backend changes; the frontend hot-reloads on its own.
- `npm run teardown` — tears the Docker services back down when the human is done.

**Testing:**

- `npm test` — runs all unit tests (vitest, project-aware).
- `npx vitest path/to/file.test.ts` — single unit test file; use `-t "<pattern>"` to filter by name.
- Backend integration tests use the `.itest.ts` suffix and a different vitest config — see [.claude/rules/backend.md](rules/backend.md).

## Conventions

- **Backend test file naming**: `*.test.ts` = unit (no DB), `*.itest.ts` = integration (real Postgres/Redis/DynamoDB via testcontainers, single-threaded). Don't mix.
