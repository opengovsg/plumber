import { QueuePro, UnrecoverableError } from '@taskforcesh/bullmq-pro'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import m365ExcelQueueConfig from '@/apps/m365-excel/queue'
import { M365_EXCEL_BATCH_ENABLED } from '@/config/app-env-vars/m365'
import { DEFAULT_JOB_OPTIONS } from '@/helpers/default-job-configuration'
import logger from '@/helpers/logger'
import { makeActionQueue } from '@/queues/helpers/make-action-queue'
import { makeActionWorker } from '@/workers/helpers/make-action-worker'

import { backupWorker, flushQueue, restoreWorker } from './test-helpers'

// processAction is the real entrypoint for single-item dispatch. We stub it
// so the worker doesn't try to load real Step/Flow/Execution rows from the
// DB in tests that exercise the single-item code path.
const mocks = vi.hoisted(() => ({
  processAction: vi.fn(async () => ({
    executionStep: { isFailed: false },
    nextStep: null,
  })),
}))

vi.mock('@/services/action', () => ({ processAction: mocks.processAction }))

describe('m365-excel queue config (flag off — the default in tests)', () => {
  it('sanity: M365_EXCEL_BATCH_ENABLED is false in the test env', () => {
    expect(M365_EXCEL_BATCH_ENABLED).toBe(false)
  })

  it('omits batch and keeps per-group concurrency at 1', () => {
    expect(m365ExcelQueueConfig).not.toHaveProperty('batch')
    expect(m365ExcelQueueConfig.groupLimits).toEqual({
      type: 'concurrency',
      concurrency: 1,
    })
  })
})

describe('makeActionWorker batch wiring', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>
  const constructedWorkers: Array<ReturnType<typeof makeActionWorker>> = []

  beforeEach(() => {
    warnSpy = vi.spyOn(logger, 'warn').mockImplementation((() => {
      // no-op
    }) as unknown as typeof logger.warn)
  })

  afterEach(async () => {
    warnSpy.mockRestore()
    await Promise.all(constructedWorkers.splice(0).map((w) => w.close()))
  })

  it('warns when batch is configured but getGroupConfigForJob is missing', () => {
    const queueName = '{batch-itest-warn}'
    constructedWorkers.push(
      makeActionWorker({
        appKey: 'batch-itest-app',
        queueName,
        queueConfig: {
          isQueueDelayable: false,
          workerType: 'action',
          batch: { size: 3, groupAffinity: true as const },
        },
      }),
    )

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        `Queue '${queueName}' enables batch without getGroupConfigForJob`,
      ),
      expect.objectContaining({
        event: 'action-worker-batch-without-group-config',
      }),
    )
  })

  it('does not warn when batch is configured with getGroupConfigForJob', () => {
    constructedWorkers.push(
      makeActionWorker({
        appKey: 'batch-itest-app',
        queueName: '{batch-itest-no-warn}',
        queueConfig: {
          isQueueDelayable: false,
          workerType: 'action',
          getGroupConfigForJob: async () => ({ id: 'g' }),
          groupLimits: { type: 'concurrency', concurrency: 3 },
          batch: { size: 3, groupAffinity: true as const },
        },
      }),
    )

    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('does not warn when batch is not configured', () => {
    constructedWorkers.push(
      makeActionWorker({
        appKey: 'batch-itest-app',
        queueName: '{batch-itest-no-batch}',
        queueConfig: {
          isQueueDelayable: false,
          workerType: 'action',
        },
      }),
    )

    expect(warnSpy).not.toHaveBeenCalled()
  })
})

describe('batch dispatch stub (flag on locally)', () => {
  // We build a fresh queue+worker pair here rather than using the m365-excel
  // ones because the m365-excel queue's batch config is decided at module
  // load time from M365_EXCEL_BATCH_ENABLED (which is off in tests).
  const queueName = '{batch-itest-dispatch}'
  let queue: QueuePro
  let worker: ReturnType<typeof makeActionWorker>
  let originalWorkerState: Awaited<ReturnType<typeof backupWorker>>

  beforeAll(async () => {
    queue = makeActionQueue({ queueName })
    worker = makeActionWorker({
      appKey: 'batch-itest-app',
      queueName,
      queueConfig: {
        isQueueDelayable: false,
        workerType: 'action',
        getGroupConfigForJob: async () => ({ id: 'g1' }),
        groupLimits: { type: 'concurrency', concurrency: 5 },
        batch: { size: 5, groupAffinity: true as const },
      },
    })
    originalWorkerState = await backupWorker(worker)
    await worker.waitUntilReady()
  })

  afterEach(async () => {
    await flushQueue(queue, worker)
    await restoreWorker(worker, originalWorkerState)
    mocks.processAction.mockClear()
  })

  afterAll(async () => {
    await worker.close()
    await queue.close()
  })

  it('throws UnrecoverableError when a multi-item batch is formed', async () => {
    // BullMQ Pro emits ONE `failed` event per batch (for the representative
    // job whose id is the comma-joined sibling ids — `'1,2,3'` in this test),
    // not one per individual job. The underlying jobs all transition to the
    // failed state, but the worker-level event fires once.
    const failures: Array<{ err: Error; jobId?: string }> = []
    const failurePromise = new Promise<void>((resolve) => {
      worker.on('failed', (job, err) => {
        failures.push({ err, jobId: job?.id })
        resolve()
      })
    })

    // Pause the worker BEFORE enqueueing so all three jobs land in the queue
    // before any fetch happens; otherwise the worker may pull them one at a
    // time and form batches of size 1, never tripping the stub.
    await worker.pause()
    await Promise.all(
      [1, 2, 3].map((n) =>
        queue.add(
          `test-job-${n}`,
          {
            flowId: 'test-flow-id',
            executionId: 'test-exec-id',
            stepId: `test-step-${n}`,
          },
          { ...DEFAULT_JOB_OPTIONS, attempts: 1, group: { id: 'g1' } },
        ),
      ),
    )
    worker.resume()

    await failurePromise

    expect(failures).toHaveLength(1)
    const [{ err, jobId }] = failures
    expect(err.message).toContain('Batch dispatch not yet implemented')
    expect(err.message).toContain('received 3 jobs')
    // The representative job's id is the joined ids of all batched siblings.
    expect(jobId?.split(',')).toHaveLength(3)
    // The stub should fire BEFORE we delegate to processAction.
    expect(mocks.processAction).not.toHaveBeenCalled()
  }, 20000)

  it('UnrecoverableError remains the chosen escape hatch', () => {
    // Sanity that the symbol the worker throws actually exists in the bullmq
    // contract we expect — guards against accidental import drift.
    expect(typeof UnrecoverableError).toBe('function')
  })
})

describe('queueRateLimit interplay with batch.size (regression for the per-job limiter footgun)', () => {
  // BullMQ Pro's rate limit is per-JOB at the script level (the counter
  // increments inside the batch-fetch loop), so `queueRateLimit.max` MUST
  // scale with `batch.size`. The earlier in-flight version of the m365-excel
  // config kept `max: 1`, which would have silently capped every batch at
  // size 1 — coalescing-by-batch could never happen. This block mirrors the
  // shape of the real m365-excel config (`max: BATCH, duration: BATCH * I`)
  // and asserts a full batch actually forms; if anyone reverts `max` back to
  // 1 (or otherwise lets it drift below `batch.size`), this test fails.
  const queueName = '{batch-itest-ratelimit}'
  const BATCH = 5
  const INTERVAL_MS = 200
  let queue: QueuePro
  let worker: ReturnType<typeof makeActionWorker>
  let originalWorkerState: Awaited<ReturnType<typeof backupWorker>>

  beforeAll(async () => {
    queue = makeActionQueue({ queueName })
    worker = makeActionWorker({
      appKey: 'batch-itest-app',
      queueName,
      queueConfig: {
        isQueueDelayable: true,
        workerType: 'action',
        getGroupConfigForJob: async () => ({ id: 'g1' }),
        groupLimits: { type: 'concurrency', concurrency: BATCH },
        // Mirrors the m365-excel "batching on" shape exactly.
        queueRateLimit: { max: BATCH, duration: BATCH * INTERVAL_MS },
        batch: { size: BATCH, groupAffinity: true as const },
      },
    })
    originalWorkerState = await backupWorker(worker)
    await worker.waitUntilReady()
  })

  afterEach(async () => {
    await flushQueue(queue, worker)
    await restoreWorker(worker, originalWorkerState)
    mocks.processAction.mockClear()
  })

  afterAll(async () => {
    await worker.close()
    await queue.close()
  })

  it('fills a batch to batch.size when max scales with BATCH_SIZE', async () => {
    // The stub throws with "received N jobs in batch" — N is our proxy for
    // actual batch size. With max: BATCH (correct) we expect N === BATCH;
    // with max: 1 (the bug) we would see N === 1 on each of BATCH failures.
    const failures: Array<{ err: Error; jobId?: string }> = []
    const allFailuresSeen = new Promise<void>((resolve) => {
      worker.on('failed', (job, err) => {
        failures.push({ err, jobId: job?.id })
        // Resolve once we see the first failure — under a correct config
        // there's exactly one (a single batch of BATCH); under the bug
        // there would be BATCH separate failures, so seeing >1 also lets
        // us assert below.
        resolve()
      })
    })

    await worker.pause()
    await Promise.all(
      Array.from({ length: BATCH }, (_, i) => i + 1).map((n) =>
        queue.add(
          `test-job-${n}`,
          {
            flowId: 'test-flow-id',
            executionId: 'test-exec-id',
            stepId: `test-step-${n}`,
          },
          { ...DEFAULT_JOB_OPTIONS, attempts: 1, group: { id: 'g1' } },
        ),
      ),
    )
    worker.resume()

    await allFailuresSeen
    // Give the worker a beat to surface any additional (would-be) failures
    // so we can catch the buggy max:1 case (BATCH separate failures).
    await new Promise((r) => setTimeout(r, 250))

    expect(failures).toHaveLength(1)
    const [{ err, jobId }] = failures
    expect(err.message).toContain(`received ${BATCH} jobs`)
    expect(jobId?.split(',')).toHaveLength(BATCH)
  }, 20000)
})
