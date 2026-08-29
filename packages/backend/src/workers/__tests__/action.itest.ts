import type { IActionJobData } from '@plumber/types'
import { type JobPro, UnrecoverableError } from '@taskforcesh/bullmq-pro'
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

import RetriableError from '@/errors/retriable-error'
import * as actionsHelper from '@/helpers/actions'
import * as backoffHelper from '@/helpers/backoff'
import { DEFAULT_JOB_OPTIONS } from '@/helpers/default-job-configuration'
import tracer from '@/helpers/tracer'
import Execution from '@/models/execution'
import type {
  actionQueuesByName as ActionQueuesByName,
  enqueueActionJob as EnqueueActionJob,
  mainActionQueue as MainActionQueue,
} from '@/queues/action'
import * as actionService from '@/services/action'
import { spyOnLogger } from '@/test/spy-on-logger'
import { createStepQueryChain, spyOnStepQuery } from '@/test/spy-on-step-query'
import type {
  appActionWorkers as AppActionWorkers,
  mainActionWorker as MainActionWorker,
} from '@/workers/action'

import {
  backupWorker,
  flushQueue,
  restoreWorker,
  type WorkerState,
} from './test-helpers'

const processAction = vi.fn(async () => ({}))
const exponentialBackoffWithJitter = vi.fn(() => 1)
const handleFailedStepAndThrow = vi.fn()
const logInfo = vi.fn()
const logError = vi.fn()
const addSpanTags = vi.fn()

describe('Action worker', () => {
  let originalWorkerState: WorkerState | null = null
  let mainActionWorker: typeof MainActionWorker
  let appActionWorkers: typeof AppActionWorkers
  let mainActionQueue: typeof MainActionQueue
  let actionQueuesByName: typeof ActionQueuesByName
  let enqueueActionJob: typeof EnqueueActionJob

  beforeAll(async () => {
    vi.resetModules()

    vi.spyOn(tracer, 'scope').mockImplementation(
      () =>
        ({
          active: vi.fn(() => ({
            addTags: addSpanTags,
          })),
        }) as never,
    )
    vi.spyOn(tracer, 'wrap').mockImplementation(
      ((_, callback) => callback) as never,
    )
    spyOnStepQuery(createStepQueryChain({ findById: vi.fn() }))
    vi.spyOn(Execution, 'setStatus').mockImplementation(vi.fn() as never)
    vi.spyOn(actionService, 'processAction').mockImplementation(
      processAction as never,
    )
    vi.spyOn(actionsHelper, 'handleFailedStepAndThrow').mockImplementation(
      handleFailedStepAndThrow as never,
    )
    vi.spyOn(backoffHelper, 'exponentialBackoffWithJitter').mockImplementation(
      exponentialBackoffWithJitter as never,
    )

    const actionQueueModule = await import('@/queues/action.js')
    enqueueActionJob = actionQueueModule.enqueueActionJob
    mainActionQueue = actionQueueModule.mainActionQueue
    actionQueuesByName = actionQueueModule.actionQueuesByName

    const actionWorkersModule = await import('@/workers/action.js')
    mainActionWorker = actionWorkersModule.mainActionWorker
    appActionWorkers = actionWorkersModule.appActionWorkers

    originalWorkerState = await backupWorker(mainActionWorker)
    await mainActionWorker.waitUntilReady()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    spyOnLogger({ info: logInfo, error: logError })
    processAction.mockReset()
    processAction.mockResolvedValue({})
    handleFailedStepAndThrow.mockReset()
    exponentialBackoffWithJitter.mockReset()
    exponentialBackoffWithJitter.mockReturnValue(1)
  })

  afterEach(async () => {
    await flushQueue(mainActionQueue, mainActionWorker)

    // Tests tend to clobber workers (e.g adding listeners), so restore
    // original state after each test
    await restoreWorker(mainActionWorker, originalWorkerState)

    vi.clearAllMocks()
  })

  // Close workers and queues so they don't linger in the shared test process
  // and steal jobs from later itest files on the same Redis queue.
  afterAll(async () => {
    await Promise.all(
      [mainActionWorker, ...Object.values(appActionWorkers)].map((w) =>
        w.close(),
      ),
    )
    await Promise.all(Object.values(actionQueuesByName).map((q) => q.close()))
  })

  describe('Automatic retries with default job options', () => {
    it('sanity check: default job options has positive retries', () => {
      expect(DEFAULT_JOB_OPTIONS.attempts).toBeGreaterThan(0)
    })

    it('does not retry successful executions', async () => {
      processAction.mockResolvedValueOnce({
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

      expect(handleFailedStepAndThrow).not.toHaveBeenCalled()
      expect(exponentialBackoffWithJitter).not.toHaveBeenCalled()
    })

    it('retries retriable executions using our custom backoff strategy', async () => {
      // Override max attempts to reduce test running time.
      const maxAttempts = 3

      processAction.mockResolvedValue({
        executionStep: { isFailed: true },
      })
      handleFailedStepAndThrow.mockRejectedValue(
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

      expect(exponentialBackoffWithJitter).toHaveBeenCalled()
    }, 20000)

    it('does not retry non-executable executions', async () => {
      processAction.mockResolvedValueOnce({
        executionStep: { isFailed: true },
      })
      handleFailedStepAndThrow.mockRejectedValue(
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
      expect(exponentialBackoffWithJitter).not.toHaveBeenCalled()
    })
  })

  describe('Event listeners', () => {
    it('logs job starts and completions', async () => {
      processAction.mockResolvedValueOnce({
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

      expect(logInfo).toHaveBeenCalledWith(
        `[action] JOB ID: ${job.id} - FLOW ID: test-flow-id has started!`,
        expect.anything(),
      )
      expect(logInfo).toHaveBeenCalledWith(
        `[action] JOB ID: ${job.id} - FLOW ID: test-flow-id has completed!`,
        expect.anything(),
      )
    })

    it('logs an error on job failure', async () => {
      processAction.mockResolvedValueOnce({
        executionStep: { isFailed: true },
      })
      handleFailedStepAndThrow.mockRejectedValue(
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

      expect(logError).toHaveBeenCalledWith(
        `[action] JOB ID: ${job.id} - FLOW ID: test-flow-id has failed to start with some error`,
        expect.anything(),
      )
    })

    it('logs an error if an event callback itself throws an error', async () => {
      mainActionWorker.on('completed', () => {
        throw new Error('callback error')
      })

      processAction.mockResolvedValueOnce({
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

      expect(logError).toHaveBeenCalledWith(
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
      processAction.mockResolvedValueOnce({
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

      expect(addSpanTags).toHaveBeenCalledWith(
        expect.objectContaining({
          jobEnqueueTime: startTime,
          jobDelay: 0,
          timeInJobQueue: MOCK_TIME_IN_QUEUE_MS,
        }),
      )
    })

    it.each([
      {
        delay: 500,
      },
      {
        delay: 0,
      },
    ])(
      'correctly records job enqueue time, delay and time in job queue for delayed jobs',
      async ({ delay }) => {
        processAction.mockResolvedValueOnce({
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

        expect(addSpanTags).toHaveBeenCalledWith(
          expect.objectContaining({
            jobEnqueueTime: startTime,
            jobDelay: delay,
            timeInJobQueue: MOCK_TIME_IN_QUEUE_MS,
          }),
        )
      },
    )

    it('measures time in job queue from a manual retry stamp instead of the stale original job creation time', async () => {
      const DAYS_STALE_MS = 3 * 24 * 60 * 60 * 1000
      const RETRY_WAIT_MS = 250

      // Job originally created 3 days before it's manually retried.
      vi.setSystemTime(startTime - DAYS_STALE_MS)

      processAction.mockResolvedValueOnce({
        executionStep: { isFailed: true },
      })
      handleFailedStepAndThrow.mockRejectedValueOnce(
        new UnrecoverableError('not retriable error'),
      )

      // WorkerPro's 'failed' event is typed with base bullmq's Job (not
      // JobPro) since WorkerPro doesn't override it, but the job instance is
      // actually a JobPro at runtime - we need JobPro's updateData/retry below.
      let failedJob: JobPro<IActionJobData>
      const jobFailed = new Promise<void>((resolve) => {
        mainActionWorker.on('failed', async (job) => {
          failedJob = job as unknown as JobPro<IActionJobData>
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
      await jobFailed

      // The job then sits failed for days until a human manually retries it -
      // mirrors retry-execution-step.ts's stamp-then-retry sequence.
      vi.setSystemTime(startTime)
      await failedJob.updateData({
        ...failedJob.data,
        retryTimestamp: Date.now(),
      })

      processAction.mockResolvedValueOnce({
        executionStep: { isFailed: false, nextStep: null },
      })

      const jobProcessed = new Promise<void>((resolve) => {
        mainActionWorker.on('completed', async (_) => {
          resolve()
        })
      })
      mainActionWorker.on('active', async (_) => {
        // Advance clock by the mocked wait between the manual retry stamp and
        // the worker actually picking the job back up.
        vi.setSystemTime(startTime + RETRY_WAIT_MS)
      })

      await failedJob.retry()
      await jobProcessed

      expect(addSpanTags).toHaveBeenCalledWith(
        expect.objectContaining({
          jobEnqueueTime: startTime,
          jobDelay: 0,
          timeInJobQueue: RETRY_WAIT_MS,
        }),
      )
    })
  })
})
