---
paths:
  - 'packages/backend/**/*'
---

# Backend

Express + Apollo GraphQL server, BullMQ workers, Knex/Objection on Postgres, plus DynamoDB and Redis. Path alias `@/*` → `packages/backend/src/*`. The web server ([packages/backend/src/server.ts](../../packages/backend/src/server.ts)) and the worker process ([packages/backend/src/worker.ts](../../packages/backend/src/worker.ts)) deploy separately and share most code; only `worker.ts` should import the `workers/*` entry points.

## Important commands

Run from [packages/backend/](../../packages/backend/) or via `pnpm --filter backend …`.

**Testing:**

- `pnpm run test:unit` — unit tests (`src/**/*.test.ts`, no DB).
- `pnpm run test:integration` — integration tests (`src/**/*.itest.ts`); uses testcontainers (Docker required) and runs single-threaded.
- `pnpm exec vitest -c packages/backend/vitest.config.integration.ts path/to/file.itest.ts` — single integration file.

**Creating test data (DynamoDB local only):**

- `pnpm run dynamodb:setup` — create the tile table.
- `pnpm run dynamodb:seed <table-id>` — seed 10k rows into the given table.

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

## Errors

Paths are relative to `packages/backend/src/`.

### Error families

The backend has three error families. Do not add a new family.

- `BaseError` (`errors/base.ts`): internal side effects and control flow (e.g. `RetriableError`).
- `StepError` (`errors/step.ts`): tells the user why a step failed.
- `UserFacingError` (`errors/user-facing-error.ts`): every error a user sees outside a step, in GraphQL and REST.

### Which error to throw

- A step failure the user sees: throw `StepError` with a `kind`.
- A user-visible failure outside a step: throw `UserFacingError`, in GraphQL resolvers and REST endpoints (e.g. AI builder) alike.
- Anything else counts as a Plumber bug. This includes a raw `RetriableError` or `HttpError` that ran out of retries.

### `StepError`

- Construct it with options: `new StepError({ name, solution, kind, cause })`. `cause` is an optional `HttpError`.
- The positional constructor `new StepError(name, solution, error, extraProperties)` is `@deprecated`. Never use it in new code.
- Never migrate existing call sites. Humans migrate them, one app per PR.
- `kind` stays optional until every call site is migrated. New code always passes it.
- `PartialStepError` (`errors/partial-error.ts`) takes the same options plus `partialRetry`.
- The constructor serializes `kind` into the step's `errorDetails.kind` (`IStepError` in `@plumber/types`).
- `getStepErrorKind(error)` (`errors/step.ts`) returns the `kind` of any thrown error. A `StepError` without `kind` and any other error return `internal`.
- `handleFailedJob` (`workers/helpers/handle-failed-job.ts`) adds `event: 'action-job-failed'`, `willRetry`, `kind` and `appKey` to its per-attempt error log. Monitors read it with `@willRetry:false`, because logs are not sampled.
- The log reads `kind` from the failed job's error when it is a `StepError`, else from its `cause`. Code that replaces a `StepError` with another error (e.g. `UnrecoverableError`) calls `attachHiddenCauseIfStepError` (`errors/step.ts`). It sets `cause` as non-enumerable, so log redaction never walks into it.

#### Choosing `kind`

The thrower chooses `kind`. Never derive it later from messages or status codes.

- `config`: the user's configuration caused the failure. Counts as good in the pipe run SLA. Never retries: `handleFailedStepAndThrow` (`helpers/actions/handle-failed-step-and-throw.ts`) throws `UnrecoverableError` for it.
- `third-party`: an external service failed. Counts as bad, but apart from Plumber bugs.
- `internal`: a Plumber bug. Counts as bad.

Special cases:

- A rate limit (429, `RATE-LIMITED`) is `internal`. Plumber must drain its queues fast enough to avoid rate limits.
- A user's own endpoint failing (custom-api) is `config`. The user owns the endpoint.
- Any non-`StepError` thrown from a step counts as `internal`. This includes `UserFacingError`, a plain `Error` and a raw `HttpError`.
- A wrong `config` hides a real failure from the SLA. Add a unit test at every `config` site.

### `UserFacingError`

- It has no `kind`. Its class already means a failure the user sees outside a step.
- In GraphQL, an error without a code reaches the frontend as `INTERNAL_SERVER_ERROR` (`formatError` in `helpers/graphql-instance.ts`). This includes `UserFacingError` and a direct `new BaseError(...)`.

### Library error types

Use a library's error types only at its boundary:

- when the library needs them to change its behavior (e.g. `UnrecoverableError` stops BullMQ retries), or
- when the library creates them itself (e.g. Apollo parse and validation errors).

This applies to Apollo/GraphQL, BullMQ, Zod and Objection.

A GraphQL resolver that needs a client error code throws a class from `errors/graphql-errors/`.
