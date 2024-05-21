import { UnrecoverableError } from '@taskforcesh/bullmq-pro'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { DEFAULT_JOB_OPTIONS } from '@/helpers/default-job-configuration'
import { mainActionWorker } from '@/workers/action'

import {
  backupWorker,
  flushQueue,
  restoreWorker,
  type WorkerState,
} from './test-helpers'

const mocks = vi.hoisted(() => ({
  processAction: vi.fn(async () => ({})),
  enqueueActionJob: vi.fn(async () => ({})),
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
      findById: vi.fn(() => ({
        appKey: 'some-app',
      })),
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

vi.mock('@/queues/action', async (importOriginal) => {
  const actualModule = await importOriginal<typeof import('@/queues/action')>()
  return {
    ...actualModule,
    enqueueActionJob: mocks.enqueueActionJob,
  }
})

describe('Action worker job enqueueing', () => {
  let originalWorkerState: WorkerState | null = null
  // This is needed as we need to mock enqueueActionJob to test.
  let unmockedEnqueueActionJob:
    | typeof import('@/queues/action')['enqueueActionJob']
    | null = null
  let mainActionQueue:
    | typeof import('@/queues/action')['mainActionQueue']
    | null = null

  beforeAll(async () => {
    originalWorkerState = await backupWorker(mainActionWorker)

    vi.doUnmock('@/queues/action')
    const actionQueues = await import('@/queues/action')
    unmockedEnqueueActionJob = actionQueues.enqueueActionJob
    mainActionQueue = actionQueues.mainActionQueue

    await mainActionWorker.waitUntilReady()
  })

  afterEach(async () => {
    await flushQueue(mainActionQueue, mainActionWorker)

    // Tests tend to clobber workers (e.g adding listeners), so restore
    // original state after each test
    await restoreWorker(mainActionWorker, originalWorkerState)

    vi.restoreAllMocks()
  })

  it('enqueues the next step to the correct app queue', async () => {
    mocks.processAction.mockResolvedValueOnce({
      executionStep: { isFailed: false, nextStep: null },
      nextStep: {
        id: 'next-step-id',
        appKey: 'next-step-app',
      },
    })

    const jobProcessed = new Promise<void>((resolve) => {
      mainActionWorker.on('completed', async (_) => {
        resolve()
      })
    })
    await unmockedEnqueueActionJob({
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

    expect(mocks.enqueueActionJob).toBeCalledWith(
      expect.objectContaining({
        appKey: 'next-step-app',
      }),
    )
  })

  it('throws an unrecoverable error if job enqueue failed', async () => {
    mocks.processAction.mockResolvedValueOnce({
      executionStep: { isFailed: false, nextStep: null },
      nextStep: {
        id: 'next-step-id',
        appKey: 'next-step-app',
      },
    })
    mocks.enqueueActionJob.mockRejectedValueOnce(new Error('test-error'))

    const jobProcessed = new Promise<void>((resolve) => {
      mainActionWorker.on('failed', async (_job, err) => {
        if (err instanceof UnrecoverableError && err.message === 'test-error') {
          resolve()
        }
      })
    })
    await unmockedEnqueueActionJob({
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

    expect(mocks.enqueueActionJob).toBeCalledWith(
      expect.objectContaining({
        appKey: 'next-step-app',
      }),
    )
  })
})
