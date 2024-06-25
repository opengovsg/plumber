import { UnrecoverableError } from '@taskforcesh/bullmq-pro'
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import RetriableError from '@/errors/retriable-error'
import { DEFAULT_JOB_OPTIONS } from '@/helpers/default-job-configuration'
import { enqueueActionJob, mainActionQueue } from '@/queues/action'
import { mainActionWorker } from '@/workers/action'

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

vi.mock('@/models/step', () => ({
  default: {
    query: vi.fn(() => ({
      findById: vi.fn(),
    })),
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

describe('Action worker', () => {
  let originalWorkerState: WorkerState | null = null

  beforeAll(async () => {
    originalWorkerState = await backupWorker(mainActionWorker)
    await mainActionWorker.waitUntilReady()
  })

  afterEach(async () => {
    await flushQueue(mainActionQueue, mainActionWorker)

    // Tests tend to clobber workers (e.g adding listeners), so restore
    // original state after each test
    await restoreWorker(mainActionWorker, originalWorkerState)

    vi.restoreAllMocks()
  })

  describe('Automatic retries with default job options', () => {
    it('sanity check: default job options has positive retries', () => {
      expect(DEFAULT_JOB_OPTIONS.attempts).toBeGreaterThan(0)
    })

    it('does not retry successful executions', async () => {
      mocks.processAction.mockResolvedValueOnce({
        executionStep: { isFailed: false, nextStep: null },
      })

      const jobProcessed = new Promise<void>((resolve) => {
        mainActionWorker.on('completed', async (_) => {
          resolve()
        })
      })
      await enqueueActionJob({
        appKey: null,
        jobName: 'test-job',
        jobData: {
          flowId: 'test-flow-id',
          executionId: 'test-exec-id',
          stepId: 'test-step-id',
        },
        jobOptions: DEFAULT_JOB_OPTIONS,
      })
      await jobProcessed

      expect(mocks.handleFailedStepAndThrow).not.toBeCalled()
      expect(mocks.exponentialBackoffWithJitter).not.toBeCalled()
    })

    it('retries retriable executions using our custom backoff strategy', async () => {
      // Override max attempts to reduce test running time.
      const maxAttempts = 3

      mocks.processAction.mockResolvedValue({
        executionStep: { isFailed: true },
      })
      mocks.handleFailedStepAndThrow.mockRejectedValue(
        new RetriableError({
          error: 'test retriable error',
          delayInMs: 10,
          delayType: 'step',
        }),
      )

      const jobProcessed = new Promise<void>((resolve) => {
        mainActionWorker.on('failed', async (job) => {
          if (job.attemptsMade === maxAttempts) {
            resolve()
          }
        })
      })
      await enqueueActionJob({
        appKey: null,
        jobName: 'test-job',
        jobData: {
          flowId: 'test-flow-id',
          executionId: 'test-exec-id',
          stepId: 'test-step-id',
        },
        jobOptions: {
          ...DEFAULT_JOB_OPTIONS,
          attempts: maxAttempts,
        },
      })
      await jobProcessed

      expect(mocks.exponentialBackoffWithJitter).toBeCalled()
    })

    it('does not retry non-executable executions', async () => {
      mocks.processAction.mockResolvedValueOnce({
        executionStep: { isFailed: true },
      })
      mocks.handleFailedStepAndThrow.mockRejectedValue(
        new UnrecoverableError('not retriable error'),
      )

      const jobProcessed = new Promise<void>((resolve) => {
        mainActionWorker.on('failed', async (_job, err) => {
          if (err instanceof UnrecoverableError) {
            resolve()
          }
        })
      })
      await enqueueActionJob({
        appKey: null,
        jobName: 'test-job',
        jobData: {
          flowId: 'test-flow-id',
          executionId: 'test-exec-id',
          stepId: 'test-step-id',
        },
        jobOptions: DEFAULT_JOB_OPTIONS,
      })
      await jobProcessed

      // Should not be called, since it was not retried.
      expect(mocks.exponentialBackoffWithJitter).not.toBeCalled()
    })
  })

  describe('Event listeners', () => {
    it('logs job starts and completions', async () => {
      mocks.processAction.mockResolvedValueOnce({
        executionStep: { isFailed: false, nextStep: null },
      })

      const jobProcessed = new Promise<void>((resolve) => {
        mainActionWorker.on('completed', async (_) => {
          resolve()
        })
      })
      const job = await mainActionQueue.add(
        'test-job',
        {
          flowId: 'test-flow-id',
          executionId: 'test-exec-id',
          stepId: 'test-step-id',
        },
        DEFAULT_JOB_OPTIONS,
      )
      await jobProcessed

      expect(mocks.logInfo).toHaveBeenCalledWith(
        `[action] JOB ID: ${job.id} - FLOW ID: test-flow-id has started!`,
        expect.anything(),
      )
      expect(mocks.logInfo).toHaveBeenCalledWith(
        `[action] JOB ID: ${job.id} - FLOW ID: test-flow-id has completed!`,
        expect.anything(),
      )
    })

    it('logs an error on job failure', async () => {
      mocks.processAction.mockResolvedValueOnce({
        executionStep: { isFailed: true },
      })
      mocks.handleFailedStepAndThrow.mockRejectedValue(
        new UnrecoverableError('some error'),
      )

      const jobProcessed = new Promise<void>((resolve) => {
        mainActionWorker.on('failed', async (_) => {
          resolve()
        })
      })
      const job = await mainActionQueue.add(
        'test-job',
        {
          flowId: 'test-flow-id',
          executionId: 'test-exec-id',
          stepId: 'test-step-id',
        },
        DEFAULT_JOB_OPTIONS,
      )
      await jobProcessed

      expect(mocks.logError).toHaveBeenCalledWith(
        `[action] JOB ID: ${job.id} - FLOW ID: test-flow-id has failed to start with some error`,
        expect.anything(),
      )
    })

    it('logs an error if an event callback itself throws an error', async () => {
      mainActionWorker.on('completed', () => {
        throw new Error('callback error')
      })

      mocks.processAction.mockResolvedValueOnce({
        executionStep: { isFailed: false, nextStep: null },
      })
      const jobProcessed = new Promise<void>((resolve) => {
        mainActionWorker.on('error', async (_) => {
          resolve()
        })
      })
      await enqueueActionJob({
        appKey: null,
        jobName: 'test-job',
        jobData: {
          flowId: 'test-flow-id',
          executionId: 'test-exec-id',
          stepId: 'test-step-id',
        },
        jobOptions: DEFAULT_JOB_OPTIONS,
      })
      await jobProcessed

      expect(mocks.logError).toHaveBeenCalledWith(
        '[action] Worker errored with callback error',
        expect.any(Object),
      )
    })
  })

  describe('Job timing metrics', () => {
    const MOCK_TIME_IN_QUEUE_MS = 300
    let startTime: number

    beforeEach(() => {
      startTime = Date.now()
      vi.useFakeTimers()
      vi.setSystemTime(startTime)
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('correctly records job enqueue time, delay and time in job queue for non-delayed jobs', async () => {
      mocks.processAction.mockResolvedValueOnce({
        executionStep: { isFailed: false, nextStep: null },
      })

      const jobProcessed = new Promise<void>((resolve) => {
        mainActionWorker.on('completed', async (_) => {
          resolve()
        })
      })

      mainActionWorker.on('active', async (_) => {
        // Advance clock by mocked queue waiting time
        vi.setSystemTime(startTime + MOCK_TIME_IN_QUEUE_MS)
      })

      await enqueueActionJob({
        appKey: null,
        jobName: 'test-job',
        jobData: {
          flowId: 'test-flow-id',
          executionId: 'test-exec-id',
          stepId: 'test-step-id',
        },
        jobOptions: DEFAULT_JOB_OPTIONS,
      })
      await jobProcessed

      expect(mocks.addSpanTags).toBeCalledWith(
        expect.objectContaining({
          jobEnqueueTime: startTime,
          jobDelay: 0,
          timeInJobQueue: MOCK_TIME_IN_QUEUE_MS,
        }),
      )
    })

    it.only.each([
      {
        delay: 500,
      },
      {
        delay: 0,
      },
    ])(
      'correctly records job enqueue time, delay and time in job queue for delayed jobs',
      async ({ delay }) => {
        mocks.processAction.mockResolvedValueOnce({
          executionStep: { isFailed: false, nextStep: null },
        })

        const jobProcessed = new Promise<void>((resolve) => {
          mainActionWorker.on('completed', async (_) => {
            resolve()
          })
        })

        mainActionWorker.on('active', async (_) => {
          // Advance clock by mocked queue waiting time and configured delay
          vi.setSystemTime(startTime + MOCK_TIME_IN_QUEUE_MS + delay)
        })

        await enqueueActionJob({
          appKey: null,
          jobName: 'test-job',
          jobData: {
            flowId: 'test-flow-id',
            executionId: 'test-exec-id',
            stepId: 'test-step-id',
          },
          jobOptions: {
            ...DEFAULT_JOB_OPTIONS,
            delay,
          },
        })
        await vi.advanceTimersByTimeAsync(delay)
        await jobProcessed

        expect(mocks.addSpanTags).toBeCalledWith(
          expect.objectContaining({
            jobEnqueueTime: startTime,
            jobDelay: delay,
            timeInJobQueue: MOCK_TIME_IN_QUEUE_MS,
          }),
        )
      },
    )
  })
})
