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

import { DEFAULT_JOB_OPTIONS } from '@/helpers/default-job-configuration'
import tracer from '@/helpers/tracer'
import Execution from '@/models/execution'
import * as actionQueueModule from '@/queues/action'
import { actionQueuesByName } from '@/queues/action'
import * as actionService from '@/services/action'
import { createStepQueryChain, spyOnStepQuery } from '@/test/spy-on-step-query'
import { appActionWorkers, mainActionWorker } from '@/workers/action'

import {
  backupWorker,
  flushQueue,
  restoreWorker,
  type WorkerState,
} from './test-helpers'

const processAction = vi.fn(async () => ({}))
const enqueueActionJob = vi.fn(async () => ({}))

describe('Action worker job enqueueing', () => {
  let originalWorkerState: WorkerState | null = null
  // This is needed as we need to mock enqueueActionJob to test.
  let unmockedEnqueueActionJob:
    | (typeof import('@/queues/action.js'))['enqueueActionJob']
    | null = null
  let mainActionQueue:
    | (typeof import('@/queues/action.js'))['mainActionQueue']
    | null = null

  beforeAll(async () => {
    vi.spyOn(tracer, 'scope').mockImplementation(
      () =>
        ({
          active: vi.fn(),
        }) as never,
    )
    vi.spyOn(tracer, 'wrap').mockImplementation(
      ((_, callback) => callback) as never,
    )
    spyOnStepQuery(
      createStepQueryChain({
        findById: vi.fn(() => ({
          appKey: 'some-app',
        })),
      }),
    )
    vi.spyOn(Execution, 'setStatus').mockImplementation(vi.fn() as never)
    vi.spyOn(actionService, 'processAction').mockImplementation(
      processAction as never,
    )

    originalWorkerState = await backupWorker(mainActionWorker)

    const actionQueues = await import('@/queues/action.js')
    unmockedEnqueueActionJob = actionQueues.enqueueActionJob
    mainActionQueue = actionQueues.mainActionQueue

    await mainActionWorker.waitUntilReady()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(actionQueueModule, 'enqueueActionJob').mockImplementation(
      enqueueActionJob as never,
    )
    processAction.mockReset()
    processAction.mockResolvedValue({})
    enqueueActionJob.mockReset()
    enqueueActionJob.mockResolvedValue({})
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

  it('enqueues the next step to the correct app queue', async () => {
    processAction.mockResolvedValueOnce({
      executionStep: { isFailed: false, nextStep: null },
      nextStep: {
        id: 'next-step-id',
        appKey: 'next-step-app',
      },
    })

    const jobProcessed = new Promise<void>((resolve) => {
      mainActionWorker.once('completed', async (_) => {
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

    expect(enqueueActionJob).toHaveBeenCalledWith(
      expect.objectContaining({
        appKey: 'next-step-app',
      }),
    )
  })

  it('throws an unrecoverable error if job enqueue failed', async () => {
    processAction.mockResolvedValueOnce({
      executionStep: { isFailed: false, nextStep: null },
      nextStep: {
        id: 'next-step-id',
        appKey: 'next-step-app',
      },
    })
    enqueueActionJob.mockRejectedValueOnce(new Error('test-error'))

    const jobProcessed = new Promise<void>((resolve) => {
      mainActionWorker.once('failed', async (_job, err) => {
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

    expect(enqueueActionJob).toHaveBeenCalledWith(
      expect.objectContaining({
        appKey: 'next-step-app',
      }),
    )
  })
})
