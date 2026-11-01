import { UnrecoverableError } from '@taskforcesh/bullmq-pro'
import { afterEach, describe, expect, it, vi } from 'vitest'

import StepError from '@/errors/step'

import { makeActionWorker } from '../helpers/make-action-worker'

const mocks = vi.hoisted(() => {
  const workerOn = vi.fn()

  return {
    // BullMQ worker mocks
    workerConstructor: vi.fn(function () {
      return { on: workerOn, close: vi.fn() }
    }),
    workerOn,

    // Misc mocks
    processOn: vi.fn(),
    tracerWrap: vi.fn((_name: string, processor: unknown) => processor),
    processAction: vi.fn(),
  }
})

vi.mock('@/queues/action', () => ({
  enqueueActionJob: vi.fn(),
  makeActionJobId: vi.fn(),
}))

vi.mock('@taskforcesh/bullmq-pro', async (importActual) => ({
  ...(await importActual<typeof import('@taskforcesh/bullmq-pro')>()),
  WorkerPro: mocks.workerConstructor,
}))

vi.mock('process', async () => {
  const process = await vi.importActual<typeof import('process')>('process')
  return {
    default: {
      ...process,
      on: mocks.processOn,
    },
  }
})

vi.mock('@/config/redis', async (importActual) => ({
  ...(await importActual<typeof import('@/config/redis')>()),
  createRedisClient: vi.fn(() => 'mock redis client'),
}))

vi.mock('@/helpers/tracer', () => ({
  default: {
    wrap: mocks.tracerWrap,
    scope: () => ({ active: (): null => null }),
  },
}))

vi.mock('@/models/step', () => ({
  default: { query: () => ({ findById: vi.fn() }) },
}))

vi.mock('@/services/action', () => ({
  processAction: mocks.processAction,
}))

vi.mock('@/apps', () => ({
  default: {},
}))

vi.mock('@/helpers/generate-error-email', () => ({
  isErrorEmailAlreadySent: vi.fn(),
  sendErrorEmail: vi.fn(),
}))

describe('makeActionWorker', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('creates a worker for the specified queue name', () => {
    makeActionWorker({
      appKey: 'test-app',
      queueName: '{test-app-queue}',
      queueConfig: { isQueueDelayable: false, workerType: 'action' },
    })
    expect(mocks.workerConstructor).toHaveBeenCalledWith(
      '{test-app-queue}',
      expect.anything(),
      // Must not have redis connection prefix
      expect.not.objectContaining({
        prefix: expect.any(String),
      }),
    )
  })

  it('supports specifying a redis connection prefix', () => {
    makeActionWorker({
      appKey: 'test-app',
      queueName: 'some-queue',
      redisConnectionPrefix: '{test}',
      queueConfig: { isQueueDelayable: false, workerType: 'action' },
    })
    expect(mocks.workerConstructor).toHaveBeenCalledWith(
      'some-queue',
      expect.anything(),
      expect.objectContaining({
        prefix: '{test}',
      }),
    )
  })

  it.each([
    {
      appQueueConfig: {
        getGroupConfigForJob: vi.fn(),
        isQueueDelayable: false,
        groupLimits: {
          type: 'concurrency' as const,
          concurrency: 2,
        },
        workerType: 'action' as const,
      },
      expectedWorkerOptions: expect.objectContaining({
        group: {
          concurrency: 2,
        },
      }),
    },
    {
      appQueueConfig: {
        getGroupConfigForJob: vi.fn(),
        isQueueDelayable: true,
        groupLimits: {
          type: 'rate-limit' as const,
          limit: {
            max: 2,
            duration: 100,
          },
        },
        workerType: 'action' as const,
      },
      expectedWorkerOptions: expect.objectContaining({
        group: {
          limit: {
            max: 2,
            duration: 100,
          },
        },
      }),
    },
    {
      appQueueConfig: {
        getGroupConfigForJob: vi.fn(),
        isQueueDelayable: true,
        groupLimits: {
          type: 'concurrency' as const,
          concurrency: 2,
        },
        queueRateLimit: {
          max: 1,
          duration: 5000,
        },
        workerType: 'action' as const,
      },
      expectedWorkerOptions: expect.objectContaining({
        group: {
          concurrency: 2,
        },
        limiter: {
          max: 1,
          duration: 5000,
        },
      }),
    },
    {
      appQueueConfig: {
        isQueueDelayable: false,
        queueRateLimit: {
          max: 1,
          duration: 5000,
        },
        workerType: 'action' as const,
      },
      expectedWorkerOptions: expect.objectContaining({
        limiter: {
          max: 1,
          duration: 5000,
        },
      }),
    },
  ])(
    "sets up queue according to the app's queue config",
    ({ appQueueConfig, expectedWorkerOptions }) => {
      makeActionWorker({
        appKey: 'test-app',
        queueName: '{test-app-queue}',
        queueConfig: appQueueConfig,
      })
      expect(mocks.workerConstructor).toHaveBeenCalledWith(
        '{test-app-queue}',
        expect.anything(),
        expectedWorkerOptions,
      )
    },
  )

  it('keeps a StepError as the hidden cause when processAction fails', async () => {
    makeActionWorker({
      appKey: 'test-app',
      queueName: '{test-app-queue}',
      queueConfig: { isQueueDelayable: false, workerType: 'action' },
    })
    const processor = (
      mocks.workerConstructor.mock.calls[0] as unknown[]
    )[1] as (job: unknown) => Promise<unknown>
    const stepError = new StepError({
      name: 'n',
      solution: 's',
      kind: 'config',
    })
    mocks.processAction.mockRejectedValueOnce(stepError)

    const thrown = (await processor({ id: 'job-id', data: {} }).catch(
      (error) => error,
    )) as Error

    expect(thrown).toBeInstanceOf(UnrecoverableError)
    expect(thrown.cause).toBe(stepError)
  })
})
