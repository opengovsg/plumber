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
- A user-visible failure outside a step: throw `UserFacingError`, in GraphQL resolvers and REST endpoints (e.g. AI builder) alike.
- Anything else counts as a Plumber bug. This includes a raw `RetriableError` or `HttpError` that ran out of retries.

## `StepError`

- Construct it with options: `new StepError({ name, solution, kind, cause })`. `cause` is an optional `HttpError`.
- The positional constructor `new StepError(name, solution, error, extraProperties)` is `@deprecated`. Never use it in new code.
- Never migrate existing call sites. Humans migrate them, one app per PR.
- `kind` stays optional until every call site is migrated. New code always passes it.
- `PartialStepError` (`errors/partial-error.ts`) takes the same options plus `partialRetry`.
- The constructor serializes `kind` into the step's `errorDetails.kind` (`IStepError` in `@plumber/types`).
- `getStepErrorKind(error)` (`errors/step.ts`) returns the `kind` of any thrown error. A `StepError` without `kind` and any other error return `internal`.
- `handleFailedJob` (`workers/helpers/handle-failed-job.ts`) adds `event: 'action-job-failed'`, `willRetry`, `kind` and `appKey` to its per-attempt error log. Monitors read it with `@willRetry:false`, because logs are not sampled.
- The log reads `kind` from the failed job's error when it is a `StepError`, else from its `cause`. Code that replaces a `StepError` with another error (e.g. `UnrecoverableError`) calls `attachHiddenCauseIfStepError` (`errors/step.ts`). It sets `cause` as non-enumerable, so log redaction never walks into it.

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
- In GraphQL, an error without a code reaches the frontend as `INTERNAL_SERVER_ERROR` (`formatError`, `helpers/graphql-instance.ts:95`). This includes `UserFacingError` and a direct `new BaseError(...)`.

## Library error types

Use a library's error types only at its boundary:

- when the library needs them to change its behavior (e.g. `UnrecoverableError` stops BullMQ retries), or
- when the library creates them itself (e.g. Apollo parse and validation errors).

This applies to Apollo/GraphQL, BullMQ, Zod and Objection.

A GraphQL resolver that needs a client error code throws a class from `errors/graphql-errors/`.
