import { UnrecoverableError } from '@taskforcesh/bullmq-pro'
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

// The batch feature flag is read at import time. Force it on before any module
// is evaluated; integration tests run with `isolate: true`, so this only
// affects this file's module graph.
vi.hoisted(() => {
  process.env.M365_EXCEL_BATCH_ENABLED = 'true'
})

import { DEFAULT_JOB_OPTIONS } from '@/helpers/default-job-configuration'
import {
  actionQueuesByName,
  appBatchActionQueues,
  enqueueActionJob,
  mainActionQueue,
} from '@/queues/action'
import {
  appActionWorkers,
  appBatchActionWorkers,
  mainActionWorker,
} from '@/workers/action'

import {
  backupWorker,
  flushQueue,
  restoreWorker,
  type WorkerState,
} from './test-helpers'

const mocks = vi.hoisted(() => ({
  processAction: vi.fn(async () => ({})),
  exponentialBackoffWithJitter: vi.fn(() => 1),
  handleFailedStepAndThrow: vi.fn(),
  logInfo: vi.fn(),
  logError: vi.fn(),
  addSpanTags: vi.fn(),
  // Mutable step the mocked model returns; tests steer routing/grouping via it.
  currentStep: {
    value: {
      key: 'createTableRow',
      appKey: 'm365-excel',
      parameters: { fileId: 'file-1', tableId: 'table-1' },
    } as { key: string; appKey: string; parameters: Record<string, string> },
  },
}))

vi.mock('@/helpers/logger', () => ({
  default: {
    info: mocks.logInfo,
    error: mocks.logError,
  },
}))

vi.mock('@/helpers/tracer', () => ({
  default: {
    scope: vi.fn(() => ({
      active: vi.fn(() => ({
        addTags: mocks.addSpanTags,
      })),
    })),
    wrap: vi.fn((_, callback) => callback),
  },
}))

// findById must satisfy both fetch shapes: the routing/group helpers call
// `.throwIfNotFound()`, while processSingleActionJob awaits findById directly.
vi.mock('@/models/step', () => ({
  default: {
    query: () => ({
      findById: () => ({
        throwIfNotFound: async () => mocks.currentStep.value,
        then: (
          onFulfilled: (value: unknown) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) => Promise.resolve(mocks.currentStep.value).then(onFulfilled, onRejected),
      }),
    }),
  },
}))

vi.mock('@/models/execution', () => ({
  default: {
    setStatus: vi.fn(),
  },
}))

vi.mock('@/services/action', () => ({
  processAction: mocks.processAction,
}))

vi.mock('@/helpers/actions', () => ({
  handleFailedStepAndThrow: mocks.handleFailedStepAndThrow,
}))

vi.mock('@/helpers/backoff', () => ({
  exponentialBackoffWithJitter: mocks.exponentialBackoffWithJitter,
}))

const BATCH_QUEUE_NAME = '{app-actions-m365-excel-batch}'
const REGULAR_QUEUE_NAME = '{app-actions-m365-excel}'

describe('Batch action worker', () => {
  const batchQueue = appBatchActionQueues['m365-excel']
  const batchWorker = appBatchActionWorkers['m365-excel']

  let originalWorkerState: WorkerState | null = null

  beforeAll(async () => {
    // Wiring sanity: the flag-on path must have registered both.
    expect(batchQueue).toBeDefined()
    expect(batchWorker).toBeDefined()

    originalWorkerState = await backupWorker(batchWorker)
    await batchWorker.waitUntilReady()
  })

  beforeEach(() => {
    mocks.currentStep.value = {
      key: 'createTableRow',
      appKey: 'm365-excel',
      parameters: { fileId: 'file-1', tableId: 'table-1' },
    }
  })

  afterEach(async () => {
    await flushQueue(batchQueue, batchWorker)
    await restoreWorker(batchWorker, originalWorkerState)
    vi.clearAllMocks()
  })

  afterAll(async () => {
    await Promise.all(
      [
        mainActionWorker,
        ...Object.values(appActionWorkers),
        ...Object.values(appBatchActionWorkers),
      ].map((w) => w.close()),
    )
    await Promise.all(Object.values(actionQueuesByName).map((q) => q.close()))
  })

  describe('flag-on wiring', () => {
    it('registers a dedicated batch queue and worker', () => {
      expect(batchQueue.name).toBe(BATCH_QUEUE_NAME)
      expect(batchQueue.name.endsWith('-batch}')).toBe(true)
    })
  })

  describe('enqueue routing', () => {
    // Pause so jobs stay queued and we can assert their destination queue.
    beforeEach(async () => {
      await batchWorker.pause()
    })

    it('routes createTableRow jobs to the batch queue', async () => {
      mocks.currentStep.value.key = 'createTableRow'

      const job = await enqueueActionJob({
        appKey: 'm365-excel',
        jobName: 'test-job',
        jobData: {
          flowId: 'test-flow-id',
          executionId: 'test-exec-id',
          stepId: 'test-step-id',
        },
        jobOptions: DEFAULT_JOB_OPTIONS,
      })

      expect(job.queueName).toBe(BATCH_QUEUE_NAME)
    })

    it('routes other m365-excel actions to the existing queue', async () => {
      mocks.currentStep.value.key = 'writeCellValues'

      const job = await enqueueActionJob({
        appKey: 'm365-excel',
        jobName: 'test-job',
        jobData: {
          flowId: 'test-flow-id',
          executionId: 'test-exec-id',
          stepId: 'test-step-id',
        },
        jobOptions: DEFAULT_JOB_OPTIONS,
      })

      expect(job.queueName).toBe(REGULAR_QUEUE_NAME)
    })
  })

  describe('batch processing', () => {
    it('processes a batch of 1 via the single-job path and tags batchSize 1', async () => {
      mocks.processAction.mockResolvedValueOnce({
        executionStep: { isFailed: false, nextStep: null },
      })

      const jobProcessed = new Promise<void>((resolve) => {
        batchWorker.on('completed', async () => resolve())
      })

      await enqueueActionJob({
        appKey: 'm365-excel',
        jobName: 'single-batch-job',
        jobData: {
          flowId: 'test-flow-id',
          executionId: 'test-exec-id',
          stepId: 'test-step-id',
        },
        jobOptions: DEFAULT_JOB_OPTIONS,
      })

      await jobProcessed

      expect(mocks.processAction).toHaveBeenCalledTimes(1)
      expect(mocks.addSpanTags).toHaveBeenCalledWith(
        expect.objectContaining({ batchSize: 1 }),
      )
    })

    it('throws the not-implemented stub for batches of >1 and tags batchSize', async () => {
      // Pause, enqueue several same-group jobs so they coalesce, then resume so
      // the worker fetches them as a single batch.
      await batchWorker.pause()

      const numJobs = 3
      for (let i = 0; i < numJobs; i++) {
        await enqueueActionJob({
          appKey: 'm365-excel',
          jobName: `multi-batch-job-${i}`,
          jobData: {
            flowId: 'test-flow-id',
            executionId: 'test-exec-id',
            stepId: 'test-step-id',
          },
          jobOptions: DEFAULT_JOB_OPTIONS,
        })
      }

      const batchFailed = new Promise<Error>((resolve) => {
        batchWorker.on('failed', async (_job, err) => resolve(err))
      })

      batchWorker.resume()

      const err = await batchFailed

      expect(err).toBeInstanceOf(UnrecoverableError)
      expect(err.message).toMatch(/Batch dispatch not yet implemented/)
      expect(mocks.addSpanTags).toHaveBeenCalledWith(
        expect.objectContaining({ batchSize: numJobs }),
      )
      // The stub must not reach processAction.
      expect(mocks.processAction).not.toHaveBeenCalled()
    }, 20000)
  })
})
