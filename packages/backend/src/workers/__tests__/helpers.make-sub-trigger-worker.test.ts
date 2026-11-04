import { UnrecoverableError } from '@taskforcesh/bullmq-pro'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import StepError, { getStepErrorKind } from '@/errors/step'

import { makeSubTriggerWorker } from '../helpers/make-sub-trigger-worker'

const mocks = vi.hoisted(() => ({
  workerConstructor: vi.fn(function () {
    return { on: vi.fn(), close: vi.fn() }
  }),
  tracerWrap: vi.fn((_name: string, processor: unknown) => processor),
  actionRun: vi.fn(),
}))

vi.mock('@taskforcesh/bullmq-pro', async (importActual) => ({
  ...(await importActual<typeof import('@taskforcesh/bullmq-pro')>()),
  WorkerPro: mocks.workerConstructor,
}))

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

vi.mock('@/helpers/global-variable', () => ({
  default: vi.fn(async () => ({ actionOutput: {} })),
}))

vi.mock('@/models/step', () => {
  const step = {
    id: 'step-id',
    getApp: vi.fn(),
    $relatedQuery: vi.fn(),
    getActionCommand: vi.fn(async () => ({ run: mocks.actionRun })),
  }
  return {
    default: {
      query: () => ({
        findById: () => ({ throwIfNotFound: async () => step }),
      }),
    },
  }
})

vi.mock('@/models/flow', () => {
  const flowQuery = {
    findById: () => flowQuery,
    withGraphJoined: () => flowQuery,
    withGraphFetched: () => flowQuery,
    throwIfNotFound: async () => ({ id: 'flow-id' }),
  }
  return { default: { query: () => flowQuery } }
})

vi.mock('@/models/execution', () => ({
  default: {
    query: () => ({
      findById: () => ({
        throwIfNotFound: async () => ({ id: 'execution-id' }),
      }),
    }),
  },
}))

vi.mock('@/models/execution-step', () => ({ default: {} }))

vi.mock('@/queues/action', () => ({
  enqueueActionJob: vi.fn(),
}))

vi.mock('../helpers/worker-event-handlers', () => ({
  registerWorkerEventHandlers: vi.fn(),
}))

type Processor = (job: unknown) => Promise<unknown>

describe('makeSubTriggerWorker', () => {
  let processor: Processor

  beforeEach(() => {
    makeSubTriggerWorker({ appKey: 'formsg', queueName: '{formsg-queue}' })
    processor = (
      mocks.workerConstructor.mock.calls[0] as unknown[]
    )[1] as Processor
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  const job = {
    id: 'job-id',
    data: { flowId: 'flow-id', executionId: 'execution-id', stepId: 'step-id' },
  }

  it('keeps a StepError as the hidden cause when the action fails', async () => {
    const stepError = new StepError({
      name: 'n',
      solution: 's',
      kind: 'third-party',
    })
    mocks.actionRun.mockRejectedValueOnce(stepError)

    const thrown = (await processor(job).catch((error) => error)) as Error

    expect(thrown).toBeInstanceOf(UnrecoverableError)
    expect(thrown.cause).toBe(stepError)
    expect(getStepErrorKind(thrown.cause)).toBe('third-party')
    expect(Object.keys(thrown)).not.toContain('cause')
  })

  it('attaches no cause when the action throws a non-StepError', async () => {
    mocks.actionRun.mockRejectedValueOnce(new Error('boom'))

    const thrown = (await processor(job).catch((error) => error)) as Error

    expect(thrown).toBeInstanceOf(UnrecoverableError)
    expect(thrown.cause).toBeUndefined()
    expect(getStepErrorKind(thrown.cause)).toBe('internal')
  })
})
