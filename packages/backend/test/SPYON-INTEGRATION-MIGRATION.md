# Integration test vi.spyOn migration

Migrate backend integration tests from `vi.mock()` to `vi.spyOn()` for **internal** modules (`@/…`) so more files run in the shared Vitest project (`isolate: false`).

## Baseline

Branch: `perf/parallel-integration-test-isolation`

- 2 Vitest projects: `backend-integration` (48 files) + `backend-integration-isolated` (23 files with `vi.mock`)
- CI Vitest duration: **~116s** (integration step)

## Target

Branch: `perf/parallel-integration-test-isolation`

- **64 files** in shared `backend-integration` project (`isolate: false`) using `vi.spyOn()` on real exports
- **7 files** remain in `backend-integration-isolated` (`isolate: true`):

| File                                                            | Reason                                                                |
| --------------------------------------------------------------- | --------------------------------------------------------------------- |
| `src/routes/api/__tests__/chat.itest.ts`                        | ESM: `ai`, `@langfuse/tracing`, `@ai-sdk/mcp`                         |
| `src/graphql/__tests__/mutations/delete-uploaded-file.itest.ts` | ESM: `@aws-sdk/client-s3`                                             |
| `src/helpers/__tests__/generate-error-email.itest.ts`           | ESM: `luxon` (+ `@/helpers/send-email`)                               |
| `src/workers/__tests__/action.itest.ts`                         | Import-time capture of `exponentialBackoffWithJitter` / `tracer.wrap` |
| `src/workers/__tests__/trigger.itest.ts`                        | Same worker import-time deps                                          |
| `src/workers/__tests__/flow.itest.ts`                           | Same worker import-time deps                                          |
| `src/workers/__tests__/action.enqueue-jobs.itest.ts`            | Same worker import-time deps                                          |

## What changed

- Migrated **16 integration test files** from `vi.mock('@/…')` to `vi.spyOn()`
- Reused `@/test/spy-on-logger` and `@/test/spy-on-step-query` from unit migration
- Reverted worker itests to `vi.mock()` after spyOn caused import-time mock misses
- Increased `hookTimeout` to 120s in `vitest.config.integration.ts` — DynamoDB wipe after 10k-row tile tests exceeded the default 10s hook limit

## Patterns

Same as unit tests — see `test/SPYON-MIGRATION-BENCHMARK.md`.

**Critical rule:** A file with **any** remaining `vi.mock()` stays in `backend-integration-isolated`. Partial migration within a file gives zero perf win.

## Results (CI run `33271546864`, commit `4a811fc8`)

| Metric                        | Baseline  | This branch | Delta    |
| ----------------------------- | --------- | ----------- | -------- |
| Vitest duration               | **~116s** | **100.36s** | **−13%** |
| Turbo `test:integration` step | ~116s     | **1m46s**   | similar  |
| Shared project files          | 48        | 64          | +16      |
| Isolated project files        | 23        | 7           | −16      |
| Test files / tests            | 71 / 814  | 71 / 814    | same     |

All CI checks pass after formatting fix (814 integration tests green).
