---
paths:
  - 'packages/backend/**/*'
---

# Backend

Express + Apollo GraphQL server, BullMQ workers, Knex/Objection on Postgres, plus DynamoDB and Redis. Path alias `@/*` → `packages/backend/src/*`. The web server ([packages/backend/src/server.ts](../../packages/backend/src/server.ts)) and the worker process ([packages/backend/src/worker.ts](../../packages/backend/src/worker.ts)) deploy separately and share most code; only `worker.ts` should import the `workers/*` entry points.

## Important commands

Run from [packages/backend/](../../packages/backend/) or via `npm run -w backend …`.

**Testing:**

- `npm run test:unit` — unit tests (`src/**/*.test.ts`, no DB).
- `npm run test:integration` — integration tests (`src/**/*.itest.ts`); uses testcontainers (Docker required) and runs single-threaded.
- `npx vitest -c packages/backend/vitest.config.integration.ts path/to/file.itest.ts` — single integration file.

**Creating test data (DynamoDB local only):**

- `npm run dynamodb:setup` — create the tile table.
- `npm run dynamodb:seed -- <table-id>` — seed 10k rows into the given table.

## App plugin model

Every integration lives under [packages/backend/src/apps/<key>/](../../packages/backend/src/apps/) and default-exports an `IApp` (`@plumber/types`) describing metadata, `triggers`, `actions`, optional `auth`, and optional `queue`. New apps must also be registered in [packages/backend/src/apps/index.ts](../../packages/backend/src/apps/index.ts). Triggers/actions are individual modules combined via an `index.ts` array (see e.g. [packages/backend/src/apps/postman/actions/index.ts](../../packages/backend/src/apps/postman/actions/index.ts)). Static assets in each app's `assets/` are served at `/apps/<key>/assets/...` via [packages/backend/src/helpers/app-assets-handler.ts](../../packages/backend/src/helpers/app-assets-handler.ts).

## Flow execution pipeline

A flow is a sequence of steps (one trigger + N actions) persisted via Objection models in [packages/backend/src/models/](../../packages/backend/src/models/). Execution flows through three BullMQ Pro queues, each with a matching worker — produced by `make*` helpers in [packages/backend/src/queues/helpers/](../../packages/backend/src/queues/helpers/) and [packages/backend/src/workers/helpers/](../../packages/backend/src/workers/helpers/) so per-app queues can be created on demand:

- `flow` queue / [packages/backend/src/workers/flow.ts](../../packages/backend/src/workers/flow.ts) — picks up an incoming trigger event and enqueues onto a trigger queue.
- `trigger` queue / [packages/backend/src/workers/trigger.ts](../../packages/backend/src/workers/trigger.ts) — runs the trigger step, fans out to action processing.
- `action` queue(s) / [packages/backend/src/workers/action.ts](../../packages/backend/src/workers/action.ts) — runs each action step, advancing the execution.

An app may declare its own queue config (concurrency, rate limits, etc.) via the `queue` field; otherwise the generic action queue is used.

## Data stores

- **Postgres (main)** via Knex/Objection — most domain models. Config: [packages/backend/src/config/database.ts](../../packages/backend/src/config/database.ts). Migrations: [packages/backend/src/db/migrations/](../../packages/backend/src/db/migrations/).
- **Postgres (tiles)** — separate DB for the Tiles feature (user-managed tables), port 5431 locally.
- **DynamoDB** — Tiles row storage; `amazon/dynamodb-local` locally.
- **Redis** — BullMQ queues + caches.
- **S3 (MinIO locally)** — file uploads, presigned posts.

## Frontend integration

GraphQL schema and resolvers also live here ([packages/backend/src/graphql/](../../packages/backend/src/graphql/)). `graphql-shield` handles authz, `graphql-rate-limit` rate-limits. The frontend code is documented in [.claude/rules/frontend.md](frontend.md).

## Conventions

- **Tests**: try to add unit tests (`*.test.ts`) for any new code.
- **APIs**: prefer adding REST endpoints over new root GraphQL fields (queries/mutations) when exposing new functionality.
- **Axios errors**: never re-throw or log an axios error. It carries the request URL, request headers and response body, which can hold credentials or other sensitive data. Convert it to a new `Error` naming only the HTTP status code and `error.message`. Do not attach the original as `cause`, since loggers serialise the whole chain. For the pattern, see `sanitiseError` in [packages/backend/src/apps/formsg/auth/download-encrypted-attachment.ts](../../packages/backend/src/apps/formsg/auth/download-encrypted-attachment.ts).
- **GraphQL operation variables**: [packages/backend/src/helpers/morgan.ts](../../packages/backend/src/helpers/morgan.ts) writes every query's and mutation's variables into the HTTP access log. Redaction is **opt-in**. An operation redacts by adding a `<operation>.redact.ts` sibling module beside its resolver, exporting `redactVariables(variables)`, and registering it under its GraphQL field name in [graphql-operations.ts](../../packages/backend/src/helpers/redaction/graphql-operations.ts). Whole-blob secrets reuse the shared `redactEverything`. Step parameters delegate to the owning trigger's or action's `redactParams` through `redactStepParameters`, so the rest of the blob stays readable. **Ask the user before merging an operation that adds or forwards step parameters.**
