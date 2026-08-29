# vi.spyOn migration benchmark

Measure whether replacing `vi.mock('@/helpers/logger')` with `vi.spyOn(logger, …)` lets more unit test files run in the shared `isolate: false` project.

## Baseline

Branch: `perf/speed-up-backend-unit-tests` at `82e185e5`

```bash
cd packages/backend
pnpm exec vitest run --config ./vitest.config.ts --reporter=verbose 2>&1 | rg "backend-isolated|backend "
```

Note project file counts from Vitest startup, then benchmark:

```bash
/usr/bin/time -p pnpm exec vitest run --config ./vitest.config.ts
```

Or CI:

```bash
pnpm exec turbo run test:unit --filter=backend --force
```

## After spyOn migration (pilot)

Branch: `cursor/bench-spyon-migration-89df`

Same commands.

## What changed in this pilot

Converted **5 files** that previously had `vi.mock()` only for `@/helpers/logger`:

| File | Mock target |
|------|-------------|
| `helpers/__tests__/backoff.test.ts` | `logger.error` |
| `helpers/__tests__/retry-on-transient-db-error.test.ts` | `logger.warn` |
| `apps/custom-api/__tests__/common/size-monitor.test.ts` | `logger.warn` |
| `apps/custom-api/__tests__/common/stream-response.test.ts` | `logger.warn` |
| `apps/gathersg/__tests__/auth/decrypt-response.test.ts` | `logger.error` |

Those files should move from `backend-isolated` → `backend` (shared module graph).

**Scope limit:** 59 other mocked files still use `vi.mock()` for modules that cannot be spied this easily (full module replacement, hoisted factories, multiple mocks per file). A full migration is a separate effort.

## Expected outcome

- **Best case:** small unit step improvement (~few %) from 5 more files sharing one module graph per worker.
- **If flat:** the isolate split already captured most gains; spyOn migration only pays off at scale (dozens of files moved).
- **Verify:** tests pass and Vitest lists 5 fewer files under `backend-isolated`.

## Pattern used

```typescript
import logger from '@/helpers/logger'

const logError = vi.fn()

beforeEach(() => {
  vi.spyOn(logger, 'error').mockImplementation(logError)
})

afterEach(() => {
  vi.restoreAllMocks()
})
```

Works when production code imports the same logger singleton. Does **not** replace `vi.mock()` for entire module graphs (axios clients, objection models, etc.).
