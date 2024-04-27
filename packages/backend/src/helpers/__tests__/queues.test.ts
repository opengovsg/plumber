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
    it('creates a queue with our default action queue name name if params is not provided', () => {
      makeActionQueue()
      expect(mocks.queueConstructor).toHaveBeenCalledWith('action', {
        connection: 'mock redis client',
        prefix: `{actionQ}`,
      })
    })

    it('creates a queue with an appropriate queue name if an appKey is specified', () => {
      makeActionQueue({ appKey: 'test-app' })
      expect(mocks.queueConstructor).toHaveBeenCalledWith(
        '{app-actions-test-app}',
        // Must not have prefix
        {
          connection: 'mock redis client',
        },
      )
    })
  })

  describe('makeActionWorker', () => {
    it('creates a worker for our default action queue if params is not provided', () => {
      makeActionWorker()
      expect(mocks.workerConstructor).toHaveBeenCalledWith(
        'action',
        expect.anything(),
        expect.objectContaining({
          prefix: '{actionQ}',
        }),
      )
    })

    it("creates a worker for the appropriate app's action queue if appKey is specified", () => {
      makeActionWorker({
        appKey: 'test-app',
        config: { getGroupConfigForJob: vi.fn() },
      })
      expect(mocks.workerConstructor).toHaveBeenCalledWith(
        '{app-actions-test-app}',
        expect.anything(),
        // Must not have prefix
        expect.not.objectContaining({
          prefix: expect.any(String),
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
          appKey: 'test-app',
          config: appQueueConfig,
        })
        expect(mocks.workerConstructor).toHaveBeenCalledWith(
          '{app-actions-test-app}',
          expect.anything(),
          expectedWorkerOptions,
        )
      },
    )
  })
})
