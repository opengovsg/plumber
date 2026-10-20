---
paths:
  - 'packages/backend/**/*'
---

# Backend errors

Paths are relative to `packages/backend/src/`. Line numbers were checked on 2026-10-20.

## Error families

The backend has three error families. Do not add a new family.

- `BaseError` (`errors/base.ts`): internal side effects and control flow (e.g. `RetriableError`).
- `StepError` (`errors/step.ts`): tells the user why a step failed.
- `UserFacingError` (`errors/user-facing-error.ts`): every error a user sees outside a step, in GraphQL and REST.

## Which error to throw

- A step failure the user sees: throw `StepError` with a `kind`.
- A user-visible failure outside a step: throw `UserFacingError`, in GraphQL resolvers and REST endpoints (e.g. AI builder) alike. Its reason is not built yet (see "Not built yet").
- Anything else counts as a Plumber bug. This includes a raw `RetriableError` or `HttpError` that ran out of retries.

## `StepError`

- Construct it with options: `new StepError({ name, solution, kind, cause })`. `cause` is an optional `HttpError`.
- The positional constructor `new StepError(name, solution, error, extraProperties)` is `@deprecated`. Never use it in new code.
- Never migrate existing call sites. Humans migrate them, one app per PR.
- `kind` stays optional until every call site is migrated. New code always passes it.
- `PartialStepError` (`errors/partial-error.ts`) takes the same options plus `partialRetry`.
- The constructor serializes `kind` into the step's `errorDetails.kind` (`IStepError` in `@plumber/types`).
- `getStepErrorKind(error)` (`errors/step.ts`) returns the `kind` of any thrown error. A `StepError` without `kind` and any other error return `internal`.

### Choosing `kind`

The thrower chooses `kind`. Never derive it later from messages or status codes.

- `config`: the user's configuration caused the failure. Counts as good in the pipe run SLA. Never retries: `handleFailedStepAndThrow` (`helpers/actions/handle-failed-step-and-throw.ts`) throws `UnrecoverableError` for it.
- `third-party`: an external service failed. Counts as bad, but apart from Plumber bugs.
- `internal`: a Plumber bug. Counts as bad.

Special cases:

- A rate limit (429, `RATE-LIMITED`) is `internal`. Plumber must drain its queues fast enough to avoid rate limits.
- A user's own endpoint failing (custom-api) is `config`. The user owns the endpoint.
- Any non-`StepError` thrown from a step counts as `internal`. This includes `UserFacingError`, a plain `Error` and a raw `HttpError`.
- A wrong `config` hides a real failure from the SLA. Add a unit test at every `config` site.

## `UserFacingError`

- It has no `kind`. Its class already means a failure the user sees outside a step.
- Today its constructor takes only a message.
- Proposed, pending team review: the planned error rate for non-step activity (e.g. viewing pipes) counts every `UserFacingError` as a client error, like HTTP 4xx.
- In GraphQL today, an error without a code reaches the frontend as `INTERNAL_SERVER_ERROR` (`formatError`, `helpers/graphql-instance.ts:95`). This includes `UserFacingError` and a direct `new BaseError(...)`.

## Library error types

Use a library's error types only at its boundary:

- when the library needs them to change its behavior (e.g. `UnrecoverableError` stops BullMQ retries), or
- when the library creates them itself (e.g. Apollo parse and validation errors).

This applies to Apollo/GraphQL, BullMQ, Zod and Objection.

Until the `UserFacingError` reason table ships, a GraphQL resolver that needs a client error code throws a class from `errors/graphql-errors/`.

## Not built yet

Do not call these APIs.

- The `handleFailedJob` failure log (`workers/helpers/handle-failed-job.ts`). It will write one structured log with `kind` per failed action job.

Proposed 2026-10-16, pending team review:

- The `UserFacingError` reason table. Each reason (e.g. bad input, forbidden, not found, unauthorised, rate limited, tile password required) maps to a GraphQL code for `formatError` and an HTTP status for REST routes. Codes stay identical to today's, so the frontend does not change. Optional data rides along (e.g. `tableName`).
- Once the reason table ships, never throw GraphQL errors (e.g. `BadUserInputError`, `ForbiddenError`) to carry meaning.
- `formatError` as the only GraphQL adapter. `UserFacingError` maps to its code. Library-generated client errors keep their codes. Anything else maps to `INTERNAL_SERVER_ERROR`.
- 4 local error classes move into families:
  - `InvalidTileViewKeyError` (`errors/invalid-tile-view-key.ts`) and `InvalidTileViewTokenError` (`errors/invalid-tile-view-password.ts`) become `UserFacingError` with a reason and `tableName`. This replaces the special case at `helpers/graphql-instance.ts:109-123`.
  - `TemplateSearchNotConfiguredError` (`services/template-search.ts:12`) becomes `BaseError`. `routes/api/templates.ts:35` turns it into a 503.
  - `AttachmentSizeExceededError` (`apps/postman/common/email-helper.ts:150`) becomes `BaseError`. Postman maps it to `ATTACHMENT-SIZE-EXCEEDED` before the user sees it.
