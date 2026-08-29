# vi.spyOn migration benchmark

Migrate backend unit tests from `vi.mock()` to `vi.spyOn()` for **internal** modules (`@/…`) so most files run in one shared Vitest project (`isolate: false`).

## Baseline

Branch: `perf/speed-up-backend-unit-tests` at `82e185e5`

- 2 Vitest projects: `backend` (~81 files) + `backend-isolated` (~64 files with `vi.mock`)
- Cold CI: **96.79s** Vitest duration, **1m42s** turbo step

## Target

Branch: `cursor/bench-spyon-migration-89df`

- **~133 files** in shared `backend` project (`isolate: false`) using `vi.spyOn()` on real exports
- **~12 files** remain in `backend-isolated` (`isolate: true`) where `vi.mock()` is still required:
  - ESM npm packages that cannot be spied (`@aws-sdk/*`, `@taskforcesh/bullmq-pro`, `rate-limiter-flexible`, `sqs-consumer`, `ai`, …)
  - Modules imported at load time by the unit under test (FormSG trigger subgraph)
- Shared `src/test/unit-setup.ts` mocks `createRedisClient` so queue modules can load safely in the shared graph

## Results (CI run `33269675235`, commit `27dd415b`)

| Metric | Baseline | This branch | Delta |
|--------|----------|-------------|-------|
| Vitest duration | **96.79s** | **34.84s** | **−64%** |
| Turbo `test:unit` step | ~102s | **39.7s** | **−61%** |
| Shared project files | ~81 | ~133 | +52 |
| Isolated project files | ~64 | ~12 | −52 |
| Test files / tests | 145 / 2024 | 145 / 2024 | same |

All CI checks pass (unit, integration, typecheck, format, build, lint).

## What changed

- Replaced `vi.mock('@/…')` with `vi.spyOn()` in ~50 test files
- Added `@/test/spy-on-logger` and `@/test/spy-on-step-query` helpers
- Kept `vi.mock()` only where Vitest/ESM cannot spy (external packages + import-time deps)
- Restored auto-detected `backend-isolated` project for any file that still contains `vi.mock()`

## Patterns

**Logger**

```typescript
import { spyOnLogger } from '@/test/spy-on-logger'

beforeEach(() => {
  const loggerSpies = spyOnLogger({ error: logError })
})
```

**Step.query chains**

```typescript
import { createStepQueryChain, spyOnStepQuery } from '@/test/spy-on-step-query'

beforeEach(() => {
  spyOnStepQuery(
    createStepQueryChain({
      findById: vi.fn(() => ({ throwIfNotFound: stepQueryResult })),
    }),
  )
})
```

**Module init (queues/action.ts)**

```typescript
beforeAll(async () => {
  vi.resetModules()
  vi.spyOn(makeActionQueueModule, 'makeActionQueue').mockImplementation(fn)
  await import('@/queues/action.js')
})
```

Call `vi.restoreAllMocks()` in `afterEach` / `afterAll`. `unit-setup.ts` re-applies the Redis client mock after each test.
