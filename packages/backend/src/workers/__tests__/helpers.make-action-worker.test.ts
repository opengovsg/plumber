import { afterEach, describe, expect, it, vi } from 'vitest'

import { makeActionWorker } from '../helpers/make-action-worker'

const mocks = vi.hoisted(() => {
  const workerOn = vi.fn()

  return {
    // BullMQ worker mocks
    workerConstructor: vi.fn(() => ({
      on: workerOn,
      close: vi.fn(),
    })),
    workerOn,

    // Misc mocks
    processOn: vi.fn(),
  }
})

vi.mock('@/queues/action', () => ({
  enqueueActionJob: vi.fn(),
  makeActionJobId: vi.fn(),
}))

vi.mock('@taskforcesh/bullmq-pro', () => ({
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

vi.mock('@/config/redis', () => ({
  createRedisClient: vi.fn(() => 'mock redis client'),
}))

vi.mock('@/helpers/tracer', () => ({
  default: {
    wrap: vi.fn(() => ({})),
  },
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
    vi.restoreAllMocks()
  })

  it('creates a worker for the specified queue name', () => {
    makeActionWorker({
      queueName: '{test-app-queue}',
      queueConfig: { isQueueDelayable: false },
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
      queueName: 'some-queue',
      redisConnectionPrefix: '{test}',
      queueConfig: { isQueueDelayable: false },
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
})
