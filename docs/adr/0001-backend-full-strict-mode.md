# Enable full strict mode on backend

`packages/backend/tsconfig.json` currently sets only `noImplicitAny`. Frontend already runs with `strict: true` and zero suppressions. We are extending full `strict: true` to backend, matching frontend, instead of enabling `strictNullChecks` alone.

The change must land with zero type errors. No `@ts-expect-error`, `@ts-ignore`, or `@ts-nocheck` is permitted to defer a fix.

A cast (`as T`) that removes `null` or `undefined` from a value is permitted only when the invariant is genuinely un-representable to the type checker (e.g. a validated regex `.exec()` result, an incorrect third-party type). It is never permitted to bypass a real null check on a value that can be null or undefined at runtime, such as a database query result, a queue payload, or an external API response.

The same principle applies to `strictPropertyInitialization` errors on Objection model classes. A definite assignment assertion (`!`) is the correct idiom for a property Objection always populates from the DB row. It must not be used to hide a genuinely nullable column. When a column can be null at runtime, such as a soft-delete timestamp, the property type is widened to include `| null` instead, so the real error surfaces at every call site that forgot to handle it.

Backend is too large (~120k lines) to fix in one PR. The rollout is staged through `packages/backend/tsconfig.strict.json`, which extends the base config, sets `strict: true`, and `exclude`s every path not yet fixed. A new `typecheck:strict` script runs it in CI as an additional required check, alongside the existing `typecheck`, which keeps checking everything under the current (non-strict) rules so no path goes unchecked mid-migration. Each PR removes fixed paths from the `exclude` list. The final PR deletes `tsconfig.strict.json`, moves `strict: true` into the base `tsconfig.json`, and collapses `typecheck:strict` back into `typecheck`.

`packages/backend-archive` is explicitly out of scope for this rollout. It gets the same treatment as a separate follow-up, tracked in [docs/backend-archive-strict-mode-followup.md](../backend-archive-strict-mode-followup.md).

## Considered Options

- **One PR fixing all of backend at once.** Rejected: a single review of changes spanning 120k lines is not reviewable.
- **Land with suppressions (`@ts-expect-error`) and a tracked backlog.** Rejected: suppressions let the flag flip without forcing a real look at each site, defeating the purpose of turning `strict` on.

## Consequences

A cast is a claim the author is vouching for, not an escape hatch. Reviewers should treat every new cast, and every new `!` assertion, in this rollout as a claim to verify, not a mechanical unblock.
