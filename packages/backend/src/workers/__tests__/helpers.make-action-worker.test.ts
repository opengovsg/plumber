import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import type { makeActionWorker as MakeActionWorkerFn } from '../helpers/make-action-worker'

describe('makeActionWorker', () => {
  const workerOn = vi.fn()
  const workerConstructor = vi.fn(function () {
    return { on: workerOn, close: vi.fn() }
  })

  let makeActionWorker: typeof MakeActionWorkerFn

  function createMockQueue(name: string) {
    return {
      name,
      close: vi.fn(),
      add: vi.fn(),
      getJob: vi.fn(),
    }
  }

  beforeAll(async () => {
    vi.resetModules()

    const bullmq = await import('@taskforcesh/bullmq-pro')
    vi.spyOn(bullmq, 'WorkerPro').mockImplementation(workerConstructor as never)

    const redisConfig = await import('@/config/redis')
    vi.spyOn(redisConfig, 'createRedisClient').mockReturnValue(
      'mock redis client' as never,
    )

    const tracerModule = await import('@/helpers/tracer')
    vi.spyOn(tracerModule.default, 'wrap').mockImplementation(
      ((_name, fn) => fn) as never,
    )

    const makeActionQueueModule = await import(
      '@/queues/helpers/make-action-queue'
    )
    vi.spyOn(makeActionQueueModule, 'makeActionQueue').mockImplementation(
      ({ queueName }) => createMockQueue(queueName) as never,
    )

    const actionQueueModule = await import('@/queues/action')
    vi.spyOn(actionQueueModule, 'enqueueActionJob').mockResolvedValue(
      {} as never,
    )
    vi.spyOn(actionQueueModule, 'makeActionJobId').mockReturnValue('job-id')

    const workerModule = await import('../helpers/make-action-worker')
    makeActionWorker = workerModule.makeActionWorker
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  afterAll(() => {
    vi.restoreAllMocks()
    process.removeAllListeners('SIGTERM')
  })

  it('creates a worker for the specified queue name', () => {
    makeActionWorker({
      appKey: 'test-app',
      queueName: '{test-app-queue}',
      queueConfig: { isQueueDelayable: false, workerType: 'action' },
    })
    expect(workerConstructor).toHaveBeenCalledWith(
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
    expect(workerConstructor).toHaveBeenCalledWith(
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
      expect(workerConstructor).toHaveBeenCalledWith(
        '{test-app-queue}',
        expect.anything(),
        expectedWorkerOptions,
      )
    },
  )
})
