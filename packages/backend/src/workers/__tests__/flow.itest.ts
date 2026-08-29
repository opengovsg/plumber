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

import Flow from '@/models/flow'
import flowQueue from '@/queues/flow'
import triggerQueue from '@/queues/trigger'
import * as flowService from '@/services/flow'
import { spyOnLogger } from '@/test/spy-on-logger'
import { worker as flowWorker } from '@/workers/flow'

import {
  backupWorker,
  flushQueue,
  restoreWorker,
  type WorkerState,
} from './test-helpers'

const processFlow = vi.fn(async () => ({
  data: [],
  error: null,
}))
const logInfo = vi.fn()
const logError = vi.fn()
const logWarn = vi.fn()
const flowQueryResult = vi.fn(() => ({
  active: true,
  getTriggerStep: vi.fn(async () => ({})),
}))

describe('Flow worker', () => {
  let originalWorkerState: WorkerState | null = null

  beforeAll(async () => {
    vi.spyOn(triggerQueue, 'add').mockImplementation(vi.fn() as never)
    vi.spyOn(Flow, 'query').mockImplementation(
      () =>
        ({
          findById: vi.fn(() => ({
            throwIfNotFound: flowQueryResult,
          })),
        }) as never,
    )
    vi.spyOn(flowService, 'processFlow').mockImplementation(
      processFlow as never,
    )

    originalWorkerState = await backupWorker(flowWorker)
    await flowWorker.waitUntilReady()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    spyOnLogger({ info: logInfo, error: logError, warn: logWarn })
    processFlow.mockReset()
    processFlow.mockResolvedValue({
      data: [],
      error: null,
    })
  })

  afterEach(async () => {
    await flushQueue(flowQueue, flowWorker)

    // Tests tend to clobber workers (e.g adding listeners), so restore
    // original state after each test
    await restoreWorker(flowWorker, originalWorkerState)

    vi.clearAllMocks()
  })

  // Close worker and queue so they don't linger in the shared test process
  // and steal jobs from later itest files on the same Redis queue.
  afterAll(async () => {
    await flowWorker.close()
    await flowQueue.close()
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

      expect(logInfo).toHaveBeenCalledWith(
        `JOB ID: ${job.id} - FLOW ID: test-flow-id has started!`,
      )
    })

    it('logs an error on job failure', async () => {
      processFlow.mockImplementation(() => {
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

      expect(logError).toHaveBeenCalledWith(
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

      expect(logError).toHaveBeenCalledWith(
        'Worker errored with callback error',
        expect.any(Object),
      )
    })
  })
})
