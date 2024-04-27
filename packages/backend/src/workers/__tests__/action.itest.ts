import { UnrecoverableError } from '@taskforcesh/bullmq-pro'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { DEFAULT_JOB_OPTIONS } from '@/helpers/default-job-configuration'
import { enqueueActionJob, mainActionQueue } from '@/queues/action'
import { mainActionWorker } from '@/workers/action'

import {
  backupWorker,
  flushQueue,
  restoreWorker,
  type WorkerState,
} from './helpers'

const mocks = vi.hoisted(() => ({
  processAction: vi.fn(async () => ({})),
  exponentialBackoffWithJitter: vi.fn(() => 1),
  handleErrorAndThrow: vi.fn(),
  logInfo: vi.fn(),
  logError: vi.fn(),
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
      active: vi.fn(),
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
  handleErrorAndThrow: mocks.handleErrorAndThrow,
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

      expect(mocks.exponentialBackoffWithJitter).not.toBeCalled()
    })

    it('retries retriable executions using our custom backoff strategy', async () => {
      // Override max attempts to reduce test running time.
      const maxAttempts = 2

      mocks.processAction.mockResolvedValue({
        executionStep: { isFailed: true },
      })
      mocks.handleErrorAndThrow.mockImplementation(() => {
        throw new Error('retriable error')
      })

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
      mocks.handleErrorAndThrow.mockImplementationOnce(() => {
        throw new UnrecoverableError('not retriable error')
      })

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
      mocks.handleErrorAndThrow.mockImplementationOnce(() => {
        throw new UnrecoverableError('some error')
      })

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
})
