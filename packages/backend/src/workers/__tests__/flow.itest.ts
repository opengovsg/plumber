import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import flowQueue from '@/queues/flow'
import { worker as flowWorker } from '@/workers/flow'

import {
  backupWorker,
  flushQueue,
  restoreWorker,
  type WorkerState,
} from './helpers'

const mocks = vi.hoisted(() => ({
  processFlow: vi.fn(async () => ({
    data: [],
    error: null,
  })),
  logInfo: vi.fn(),
  logError: vi.fn(),
  flowQueryResult: vi.fn(() => ({
    getTriggerStep: vi.fn(async () => ({})),
  })),
}))

vi.mock('@/queues/trigger', () => ({
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

vi.mock('@/models/flow', () => ({
  default: {
    query: vi.fn(() => ({
      findById: vi.fn(() => ({
        throwIfNotFound: mocks.flowQueryResult,
      })),
    })),
  },
}))

vi.mock('@/services/flow', () => ({
  processFlow: mocks.processFlow,
}))

describe('Flow worker', () => {
  let originalWorkerState: WorkerState | null = null

  beforeAll(async () => {
    originalWorkerState = await backupWorker(flowWorker)
    await flowWorker.waitUntilReady()
  })

  afterEach(async () => {
    await flushQueue(flowQueue, flowWorker)

    // Tests tend to clobber workers (e.g adding listeners), so restore
    // original state after each test
    await restoreWorker(flowWorker, originalWorkerState)

    vi.restoreAllMocks()
  })

  describe('Event listeners', () => {
    it('logs jobs as started on completion', async () => {
      const jobProcessed = new Promise<void>((resolve) => {
        flowWorker.on('completed', async (_) => {
          resolve()
        })
      })
      const job = await flowQueue.add(
        'test-job',
        {
          flowId: 'test-flow-id',
        },
        {
          jobId: 'test-job-id',
        },
      )
      await jobProcessed

      expect(mocks.logInfo).toHaveBeenCalledWith(
        `JOB ID: ${job.id} - FLOW ID: test-flow-id has started!`,
      )
    })

    it('logs an error on job failure', async () => {
      mocks.processFlow.mockImplementation(() => {
        throw new Error('some error')
      })

      const jobProcessed = new Promise<void>((resolve) => {
        flowWorker.on('failed', async (_) => {
          resolve()
        })
      })
      const job = await flowQueue.add(
        'test-job',
        {
          flowId: 'test-flow-id',
        },
        {
          jobId: 'test-job-id',
        },
      )
      await jobProcessed

      expect(mocks.logError).toHaveBeenCalledWith(
        `JOB ID: ${job.id} - FLOW ID: test-flow-id has failed to start with some error`,
      )
    })

    it('logs an error if an event callback itself throws an error', async () => {
      flowWorker.on('completed', () => {
        throw new Error('callback error')
      })

      const jobProcessed = new Promise<void>((resolve) => {
        flowWorker.on('error', async (_) => {
          resolve()
        })
      })
      await flowQueue.add(
        'test-job',
        {
          flowId: 'test-flow-id',
        },
        {
          jobId: 'test-job-id',
        },
      )
      await jobProcessed

      expect(mocks.logError).toHaveBeenCalledWith(
        'Worker errored with callback error',
        expect.any(Object),
      )
    })
  })
})
