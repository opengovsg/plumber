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

import * as actionQueue from '@/queues/action'
import triggerQueue from '@/queues/trigger'
import * as triggerService from '@/services/trigger'
import { spyOnLogger } from '@/test/spy-on-logger'
import { createStepQueryChain, spyOnStepQuery } from '@/test/spy-on-step-query'
import { worker as triggerWorker } from '@/workers/trigger'

import {
  backupWorker,
  flushQueue,
  restoreWorker,
  type WorkerState,
} from './test-helpers'

const processTrigger = vi.fn(async () => ({}))
const logInfo = vi.fn()
const logError = vi.fn()
const enqueueActionJob = vi.fn()
const getNextStep = vi.fn()

describe('Trigger worker', () => {
  let originalWorkerState: WorkerState | null = null

  beforeAll(async () => {
    spyOnStepQuery(
      createStepQueryChain({
        findById: vi.fn(() => ({
          throwIfNotFound: vi.fn(() => ({
            getNextStep,
          })),
        })),
      }),
    )
    vi.spyOn(actionQueue, 'enqueueActionJob').mockImplementation(
      enqueueActionJob as never,
    )
    vi.spyOn(triggerService, 'processTrigger').mockImplementation(
      processTrigger as never,
    )

    originalWorkerState = await backupWorker(triggerWorker)
    await triggerWorker.waitUntilReady()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    spyOnLogger({ info: logInfo, error: logError })
    processTrigger.mockReset()
    processTrigger.mockResolvedValue({})
    enqueueActionJob.mockReset()
    getNextStep.mockReset()
  })

  afterEach(async () => {
    await flushQueue(triggerQueue, triggerWorker)

    // Tests tend to clobber workers (e.g adding listeners), so restore original
    // state after each test
    await restoreWorker(triggerWorker, originalWorkerState)

    vi.clearAllMocks()
  })

  // Close worker and queue so they don't linger in the shared test process
  // and steal jobs from later itest files on the same Redis queue.
  afterAll(async () => {
    await triggerWorker.close()
    await triggerQueue.close()
  })

  describe('Event listeners', () => {
    it('logs jobs as started on completion', async () => {
      processTrigger.mockResolvedValue({
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

      expect(logInfo).toHaveBeenCalledWith(
        `JOB ID: ${job.id} - FLOW ID: test-flow-id has started!`,
      )
    })

    it('logs an error on job failure', async () => {
      processTrigger.mockImplementation(() => {
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

      expect(logError).toHaveBeenCalledWith(
        `JOB ID: ${job.id} - FLOW ID: test-flow-id has failed to start with some error`,
      )
    })

    it('logs an error if an event callback itself throws an error', async () => {
      triggerWorker.on('completed', () => {
        throw new Error('callback error')
      })

      processTrigger.mockResolvedValue({
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

      expect(logError).toHaveBeenCalledWith(
        'Worker errored with callback error',
        expect.any(Object),
      )
    })
  })

  describe('Job enqueing', () => {
    it('enqueues the next step to the correct app queue', async () => {
      processTrigger.mockResolvedValue({
        executionStep: { isFailed: false, stepId: 'curr-step-id' },
      })
      getNextStep.mockResolvedValueOnce({
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

      expect(enqueueActionJob).toHaveBeenCalledWith(
        expect.objectContaining({
          appKey: 'next-step-app',
        }),
      )
    })

    it('throws an unrecoverable error if job enqueue failed', async () => {
      processTrigger.mockResolvedValueOnce({
        executionStep: { isFailed: false, stepId: 'curr-step-id' },
      })
      getNextStep.mockResolvedValueOnce({
        id: 'next-step-id',
        appKey: 'next-step-app',
      })
      enqueueActionJob.mockRejectedValueOnce(new Error('test-error'))

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
