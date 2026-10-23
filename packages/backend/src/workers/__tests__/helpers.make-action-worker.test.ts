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

    // Processor mocks
    findStepById: vi.fn(),
    processAction: vi.fn(),
    advanceAfterStep: vi.fn(),
    recordOverdueExecution: vi.fn(),
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

vi.mock('@/workers/helpers/record-overdue-execution', () => ({
  recordOverdueExecution: mocks.recordOverdueExecution,
}))

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

    const job = {
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

    it.each([
      {
        queueConfig: { isQueueDelayable: false, workerType: 'action' as const },
        groupLimited: false,
      },
      {
        queueConfig: {
          isQueueDelayable: false,
          workerType: 'action' as const,
          getGroupConfigForJob: vi.fn(),
          groupLimits: { type: 'concurrency' as const, concurrency: 1 },
        },
        groupLimited: true,
      },
    ])(
      'records overdue executions before running the step (groupLimited: $groupLimited)',
      async ({ queueConfig, groupLimited }) => {
        mocks.processAction.mockResolvedValueOnce({})
        makeActionWorker({
          appKey: 'test-app',
          queueName: '{test-app-queue}',
          queueConfig,
        })

        await getProcessor()(job)

        expect(mocks.recordOverdueExecution).toHaveBeenCalledWith({
          job,
          queueName: '{test-app-queue}',
          groupLimited,
        })
        expect(mocks.recordOverdueExecution).toHaveBeenCalledBefore(
          mocks.processAction,
        )
      },
    )
  })
})
