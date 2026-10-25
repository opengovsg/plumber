import type { IActionJobData } from '@plumber/types'
import { type JobPro, WorkerPro } from '@taskforcesh/bullmq-pro'
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

    // Errors the traced processor rejected with, i.e. spans dd-trace marks as errored
    spanErrors: [] as unknown[],
    advanceAfterStep: vi.fn(),

    // Misc mocks
    processOn: vi.fn(),
  }
})

vi.mock('@/queues/action', () => ({
  enqueueActionJob: vi.fn(),
  makeActionJobId: vi.fn(),
}))

vi.mock('@taskforcesh/bullmq-pro', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@taskforcesh/bullmq-pro')>()
  return {
    ...actual,
    WorkerPro: Object.assign(mocks.workerConstructor, {
      RateLimitError: actual.WorkerPro.RateLimitError,
    }),
  }
})

vi.mock('@/models/step', () => ({
  default: {
    query: () => ({
      findById: vi.fn(async () => ({ key: 'test-action', appKey: 'test-app' })),
    }),
  },
}))

vi.mock('@/services/action', () => ({
  processAction: vi.fn(async () => ({})),
}))

vi.mock('../helpers/advance-after-step', () => ({
  advanceAfterStep: mocks.advanceAfterStep,
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
    // Mirrors dd-trace: a rejected wrapped function marks the span as errored.
    wrap: vi.fn(
      (_name: string, fn: (...args: unknown[]) => Promise<unknown>) =>
        async (...args: unknown[]) => {
          try {
            return await fn(...args)
          } catch (err) {
            mocks.spanErrors.push(err)
            throw err
          }
        },
    ),
    scope: () => ({ active: () => ({ addTags: vi.fn() }) }),
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

  describe('processor', () => {
    const job = {
      id: 'job-id',
      data: {
        flowId: 'flow-id',
        executionId: 'execution-id',
        stepId: 'step-id',
      },
    } as unknown as JobPro<IActionJobData>

    function makeProcessor() {
      mocks.spanErrors.length = 0
      makeActionWorker({
        appKey: 'test-app',
        queueName: '{test-app-queue}',
        queueConfig: { isQueueDelayable: true, workerType: 'action' },
      })
      const [, processor] = mocks.workerConstructor.mock.calls.at(
        -1,
      ) as unknown as [string, (job: JobPro<IActionJobData>) => Promise<void>]
      return processor
    }

    it('re-throws RateLimitError to BullMQ without marking the span as errored', async () => {
      const processor = makeProcessor()
      mocks.advanceAfterStep.mockRejectedValueOnce(WorkerPro.RateLimitError())

      await expect(processor(job)).rejects.toThrow(
        WorkerPro.RateLimitError().message,
      )
      expect(mocks.spanErrors).toEqual([])
    })

    it('marks the span as errored for other failures', async () => {
      const processor = makeProcessor()
      const error = new Error('step failed')
      mocks.advanceAfterStep.mockRejectedValueOnce(error)

      await expect(processor(job)).rejects.toBe(error)
      expect(mocks.spanErrors).toEqual([error])
    })
  })
})
