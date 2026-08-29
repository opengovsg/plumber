# vi.spyOn migration benchmark

Full migration of backend unit tests from `vi.mock()` to `vi.spyOn()` so every file runs in one shared Vitest project (`isolate: false`).

## Baseline

Branch: `perf/speed-up-backend-unit-tests` at `82e185e5`

- 2 Vitest projects: `backend` (~81 files) + `backend-isolated` (~64 files with `vi.mock`)
- Cold CI: **96.79s** Vitest duration, **1m42s** turbo step

## After full spyOn migration

Branch: `cursor/bench-spyon-migration-89df`

- 1 Vitest project: `backend` (145 files, all `isolate: false`)
- Same CI command:

```bash
pnpm exec turbo run test:unit --filter=backend --force
```

## What changed

- Removed all `vi.mock()` from `src/**/*.test.ts` (64 files)
- Replaced with `vi.spyOn()` on real module exports, plus `vi.resetModules()` + dynamic import where modules run setup at load time (queues, workers, webhooks, chat router)
- Added `@/test/spy-on-logger` and `@/test/spy-on-step-query` helpers for common patterns
- Dropped the `backend-isolated` Vitest project entirely

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
import Step from '@/models/step'
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
  await import('@/queues/action')
})
```

Always call `vi.restoreAllMocks()` in `afterEach` / `afterAll`.
