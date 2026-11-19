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

    // Processor mocks
    findStepById: vi.fn(),
    processAction: vi.fn(),
    advanceAfterStep: vi.fn(),
    recordLateScheduledStart: vi.fn(),
  }
})

vi.mock('@/models/step', () => ({
  default: { query: () => ({ findById: mocks.findStepById }) },
}))

vi.mock('@/services/action', () => ({
  processAction: mocks.processAction,
}))

vi.mock('@/workers/helpers/advance-after-step', () => ({
  advanceAfterStep: mocks.advanceAfterStep,
}))

vi.mock('@/workers/helpers/record-late-scheduled-start', () => ({
  recordLateScheduledStart: mocks.recordLateScheduledStart,
}))

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
    wrap: vi.fn((_name, processor) => processor),
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

  describe('processor', () => {
    afterEach(() => {
      vi.clearAllMocks()
    })

    const baseJob = {
      id: '1',
      data: { flowId: 'flow-1', executionId: 'execution-1', stepId: 'step-1' },
      opts: {},
    }

    function getProcessor() {
      const calls = mocks.workerConstructor.mock.calls as unknown as [
        string,
        (job: unknown) => Promise<void>,
      ][]
      return calls.at(-1)[1]
    }

    const groupLimitedQueueConfig = {
      isQueueDelayable: false,
      workerType: 'action' as const,
      getGroupConfigForJob: vi.fn(),
      groupLimits: { type: 'concurrency' as const, concurrency: 1 },
    }

    it.each([
      {
        name: 'a queue without rate limits',
        queueConfig: { isQueueDelayable: false, workerType: 'action' as const },
        group: undefined,
        rateLimited: false,
      },
      {
        name: 'a grouped job on a group-limited queue',
        queueConfig: groupLimitedQueueConfig,
        group: { id: 'table-1-findSingleRow' },
        rateLimited: true,
      },
      {
        name: 'an ungrouped job on a group-limited queue',
        queueConfig: groupLimitedQueueConfig,
        group: undefined,
        rateLimited: false,
      },
      {
        name: 'an ungrouped job on a queue with a queue-wide rate limit',
        queueConfig: {
          isQueueDelayable: true,
          workerType: 'action' as const,
          queueRateLimit: { max: 1, duration: 5000 },
        },
        group: undefined,
        rateLimited: true,
      },
    ])(
      'records late scheduled starts before running the step for $name (rateLimited: $rateLimited)',
      async ({ queueConfig, group, rateLimited }) => {
        const job = { ...baseJob, opts: group ? { group } : {} }
        mocks.processAction.mockResolvedValueOnce({})
        makeActionWorker({
          appKey: 'test-app',
          queueName: '{test-app-queue}',
          queueConfig,
        })

        await getProcessor()(job)

        expect(mocks.recordLateScheduledStart).toHaveBeenCalledWith({
          job,
          queueName: '{test-app-queue}',
          rateLimited,
        })
        expect(mocks.recordLateScheduledStart).toHaveBeenCalledBefore(
          mocks.processAction,
        )
      },
    )

    it('keeps a StepError as the hidden cause when processAction fails', async () => {
      makeActionWorker({
        appKey: 'test-app',
        queueName: '{test-app-queue}',
        queueConfig: { isQueueDelayable: false, workerType: 'action' },
      })
      const stepError = new StepError({
        name: 'n',
        solution: 's',
        kind: 'config',
      })
      mocks.processAction.mockRejectedValueOnce(stepError)

      const thrown = (await getProcessor()(baseJob).catch(
        (error) => error,
      )) as Error

      expect(thrown).toBeInstanceOf(UnrecoverableError)
      expect(thrown.cause).toBe(stepError)
    })
  })
})
