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
}))

vi.mock('@/queues/action', () => ({
  default: {
    add: vi.fn(),
  },
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
})
