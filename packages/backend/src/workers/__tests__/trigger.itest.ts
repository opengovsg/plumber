import { UnrecoverableError } from '@taskforcesh/bullmq-pro'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import triggerQueue from '@/queues/trigger'
import { worker as triggerWorker } from '@/workers/trigger'

import {
  backupWorker,
  flushQueue,
  restoreWorker,
  type WorkerState,
} from './test-helpers'

const mocks = vi.hoisted(() => ({
  processTrigger: vi.fn(async () => ({})),
  logInfo: vi.fn(),
  logError: vi.fn(),
  flowQueryResult: vi.fn(() => ({
    getTriggerStep: vi.fn(async () => ({})),
  })),
  enqueueActionJob: vi.fn(),
  getNextStep: vi.fn(),
}))

vi.mock('@/models/step', () => ({
  default: {
    query: vi.fn(() => ({
      findById: vi.fn(() => ({
        throwIfNotFound: vi.fn(() => ({
          getNextStep: mocks.getNextStep,
        })),
      })),
    })),
  },
}))

vi.mock('@/queues/action', () => ({
  enqueueActionJob: mocks.enqueueActionJob,
}))

vi.mock('@/helpers/logger', () => ({
  default: {
    info: mocks.logInfo,
    error: mocks.logError,
  },
}))

vi.mock('@/services/trigger', () => ({
  processTrigger: mocks.processTrigger,
}))

describe('Trigger worker', () => {
  let originalWorkerState: WorkerState | null = null

  beforeAll(async () => {
    originalWorkerState = await backupWorker(triggerWorker)
    await triggerWorker.waitUntilReady()
  })

  afterEach(async () => {
    await flushQueue(triggerQueue, triggerWorker)

    // Tests tend to clobber workers (e.g adding listeners), so restore original
    // state after each test
    await restoreWorker(triggerWorker, originalWorkerState)

    vi.restoreAllMocks()
  })

  describe('Event listeners', () => {
    it('logs jobs as started on completion', async () => {
      mocks.processTrigger.mockResolvedValue({
        executionStep: {
          // Mock to true so that we return immediately.
          isFailed: true,
        },
      })
      const jobProcessed = new Promise<void>((resolve) => {
        triggerWorker.on('completed', async (_) => {
          resolve()
        })
      })
      const job = await triggerQueue.add('test-job', {
        flowId: 'test-flow-id',
      })
      await jobProcessed

      expect(mocks.logInfo).toHaveBeenCalledWith(
        `JOB ID: ${job.id} - FLOW ID: test-flow-id has started!`,
      )
    })

    it('logs an error on job failure', async () => {
      mocks.processTrigger.mockImplementation(() => {
        throw new Error('some error')
      })

      const jobProcessed = new Promise<void>((resolve) => {
        triggerWorker.on('failed', async (_) => {
          resolve()
        })
      })
      const job = await triggerQueue.add('test-job', {
        flowId: 'test-flow-id',
      })
      await jobProcessed

      expect(mocks.logError).toHaveBeenCalledWith(
        `JOB ID: ${job.id} - FLOW ID: test-flow-id has failed to start with some error`,
      )
    })

    it('logs an error if an event callback itself throws an error', async () => {
      triggerWorker.on('completed', () => {
        throw new Error('callback error')
      })

      mocks.processTrigger.mockResolvedValue({
        executionStep: {
          // Mock to true so that we return immediately.
          isFailed: true,
        },
      })
      const jobProcessed = new Promise<void>((resolve) => {
        triggerWorker.on('error', async (_) => {
          resolve()
        })
      })
      await triggerQueue.add('test-job', {
        flowId: 'test-flow-id',
      })
      await jobProcessed

      expect(mocks.logError).toHaveBeenCalledWith(
        'Worker errored with callback error',
        expect.any(Object),
      )
    })
  })

  describe('Job enqueing', () => {
    it('enqueues the next step to the correct app queue', async () => {
      mocks.processTrigger.mockResolvedValue({
        executionStep: { isFailed: false, stepId: 'curr-step-id' },
      })
      mocks.getNextStep.mockResolvedValueOnce({
        id: 'next-step-id',
        appKey: 'next-step-app',
      })

      const jobProcessed = new Promise<void>((resolve) => {
        triggerWorker.on('completed', async (_) => {
          resolve()
        })
      })
      await triggerQueue.add('test-job', {
        flowId: 'test-flow-id',
      })
      await jobProcessed

      expect(mocks.enqueueActionJob).toBeCalledWith(
        expect.objectContaining({
          appKey: 'next-step-app',
        }),
      )
    })

    it('throws an unrecoverable error if job enqueue failed', async () => {
      mocks.processTrigger.mockResolvedValueOnce({
        executionStep: { isFailed: false, stepId: 'curr-step-id' },
      })
      mocks.getNextStep.mockResolvedValueOnce({
        id: 'next-step-id',
        appKey: 'next-step-app',
      })
      mocks.enqueueActionJob.mockRejectedValueOnce(new Error('test-error'))

      const jobProcessed = new Promise<void>((resolve) => {
        triggerWorker.on('failed', async (_job, err) => {
          if (
            err instanceof UnrecoverableError &&
            err.message === 'test-error'
          ) {
            resolve()
          }
        })
      })
      await triggerQueue.add('test-job', {
        flowId: 'test-flow-id',
      })
      await jobProcessed
    })
  })
})
