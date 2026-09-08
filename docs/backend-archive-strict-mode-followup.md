# Follow-up: strict mode for backend-archive

`packages/backend-archive` was deferred out of [ADR-0001](adr/0001-backend-full-strict-mode.md) to keep that PR scoped to `packages/backend`.

Once backend's rollout lands, apply the same treatment here: full `strict: true`, fully clean (no suppressions), same cast and `strictPropertyInitialization` policy as ADR-0001. `backend-archive` is ~2.7k lines, so this is likely a single PR rather than a staged carve-out.
