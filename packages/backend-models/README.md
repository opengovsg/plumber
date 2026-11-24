# @plumber/backend-models

The backend's column-only Objection models, built for packages outside the backend. `backend-analytics` reads through them.

The build compiles `packages/backend/src/exports/models.ts` and the files it imports with `tsc`. It needs only `objection`, `ajv-formats`, `knex` and `@plumber/types`.

## Adding a model

1. Add a `base.ts` beside the full model, as in `packages/backend/src/models/flow/base.ts`. It holds columns, `tableName`, `jsonSchema` and nothing else.
2. Make the full model extend it.
3. Export it from `packages/backend/src/exports/models.ts`.
4. Add it to `packages/backend/src/models/__tests__/base-models.test.ts`.

IMPORTANT: a base model must not import app code. A `@/` import breaks this build. A relative import of app code compiles the app code into `dist` and fails at runtime.

The query builder skips soft-deleted rows by default. Call `.withSoftDeleted()` when an export needs them.
