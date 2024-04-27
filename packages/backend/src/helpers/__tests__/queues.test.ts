import { afterEach, describe, expect, it, vi } from 'vitest'

import { makeActionQueue } from '../queues/make-action-queue'
import { makeActionWorker } from '../queues/make-action-worker'

const mocks = vi.hoisted(() => {
  const queueOn = vi.fn()
  const workerOn = vi.fn()

  return {
    // BullMQ queue mocks
    queueConstructor: vi.fn(() => ({
      on: queueOn,
    })),
    queueOn,

    // BullMQ worker mocks
    workerConstructor: vi.fn(() => ({
      on: workerOn,
    })),
    workerOn,

    // Misc mocks
    processOn: vi.fn(),
  }
})

vi.mock('@taskforcesh/bullmq-pro', () => ({
  QueuePro: mocks.queueConstructor,
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

describe('Queue helper functions', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('makeActionQueue', () => {
    it('creates a queue with an configured queue name', () => {
      makeActionQueue({ queueName: '{test-app-queue}' })
      expect(mocks.queueConstructor).toHaveBeenCalledWith('{test-app-queue}', {
        connection: 'mock redis client',
      })
    })

    it('supports specifying a redis connection prefix', () => {
      makeActionQueue({
        queueName: 'some-queue',
        redisConnectionPrefix: '{test}',
      })
      expect(mocks.queueConstructor).toHaveBeenCalledWith('some-queue', {
        connection: 'mock redis client',
        prefix: `{test}`,
      })
    })
  })

  describe('makeActionWorker', () => {
    it('creates a worker for the specified queue name', () => {
      makeActionWorker({ queueName: '{test-app-queue}' })
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
})
