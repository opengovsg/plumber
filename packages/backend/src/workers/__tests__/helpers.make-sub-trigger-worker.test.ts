import { afterEach, describe, expect, it, vi } from 'vitest'

import { makeSubTriggerWorker } from '../helpers/make-sub-trigger-worker'

const mocks = vi.hoisted(() => {
  // Stands in for any Objection query chain and resolves to `value` when awaited.
  function queryResolving(value: unknown): unknown {
    const query: unknown = new Proxy((): void => undefined, {
      get: (_target, prop): unknown =>
        prop === 'then'
          ? (resolve: (v: unknown) => void) => resolve(value)
          : (): unknown => query,
    })
    return query
  }

  return {
    queryResolving,
    workerConstructor: vi.fn(() => ({ on: vi.fn(), close: vi.fn() })),
    globalVariable: vi.fn(),
    recordOverdueExecution: vi.fn(),
  }
})

vi.mock('@taskforcesh/bullmq-pro', () => ({
  WorkerPro: mocks.workerConstructor,
  UnrecoverableError: class UnrecoverableError extends Error {},
}))

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

vi.mock('@/queues/action', () => ({
  enqueueActionJob: vi.fn(),
}))

vi.mock('@/models/step', () => ({
  default: {
    query: () =>
      mocks.queryResolving({ getApp: vi.fn(), $relatedQuery: vi.fn() }),
  },
}))

vi.mock('@/models/flow', () => ({
  default: { query: () => mocks.queryResolving({}) },
}))

vi.mock('@/models/execution', () => ({
  default: { query: () => mocks.queryResolving({}) },
}))

vi.mock('@/helpers/global-variable', () => ({
  default: mocks.globalVariable,
}))

vi.mock('@/workers/helpers/worker-event-handlers', () => ({
  registerWorkerEventHandlers: vi.fn(),
}))

vi.mock('@/workers/helpers/record-overdue-execution', () => ({
  recordOverdueExecution: mocks.recordOverdueExecution,
}))

describe('makeSubTriggerWorker processor', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('records overdue executions before running the sub-trigger', async () => {
    const job = {
      id: '1',
      data: { flowId: 'flow-1', executionId: 'execution-1', stepId: 'step-1' },
      opts: {},
    }
    mocks.globalVariable.mockRejectedValueOnce(new Error('stop here'))
    makeSubTriggerWorker({
      appKey: 'formsg',
      queueName: '{app-actions-formsg}',
    })
    const calls = mocks.workerConstructor.mock.calls as unknown as [
      string,
      (job: unknown) => Promise<void>,
    ][]

    await expect(calls.at(-1)[1](job)).rejects.toThrow('stop here')

    expect(mocks.recordOverdueExecution).toHaveBeenCalledWith({
      job,
      queueName: '{app-actions-formsg}',
      groupLimited: false,
    })
    expect(mocks.recordOverdueExecution).toHaveBeenCalledBefore(
      mocks.globalVariable,
    )
  })
})
