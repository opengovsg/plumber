import { IFlowConfig } from '@plumber/types'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import * as computeForEachParameters from '@/helpers/compute-for-each-parameters'
import * as computeParametersModule from '@/helpers/compute-parameters'
import * as globalVariableModule from '@/helpers/global-variable'
import Execution from '@/models/execution'
import ExecutionStep from '@/models/execution-step'
import Flow from '@/models/flow'
import * as getForEachMetadataModule from '@/services/helpers/get-for-each-metadata'
import { spyOnLogger } from '@/test/spy-on-logger'
import { spyOnStepQuery } from '@/test/spy-on-step-query'

const OPTIONS = {
  flowId: 'flow-id',
  stepId: 'step-id',
  executionId: 'execution-id',
}

function createMockQueue(name: string) {
  return {
    name,
    close: vi.fn(),
    add: vi.fn(),
    getJob: vi.fn(),
  }
}

describe('processAction', () => {
  let processAction: typeof import('../action').processAction
  let actionQueueModule: typeof import('@/queues/action')

  const executionStep = {
    id: 'exec-step-id',
    isFailed: false,
    status: 'success',
  }
  const execution = {
    id: 'execution-id',
    $relatedQuery: vi.fn(() => ({
      insertAndFetch: vi.fn(() => ({
        onConflict: vi.fn(() => ({
          ignore: vi.fn(() => () => executionStep),
        })),
      })),
    })),
  }
  const step = {
    id: 'step-id',
    appKey: 'webhook',
    parameters: {},
    key: 'new-submission',
    config: {},
    getApp: vi.fn(() => ({ key: 'webhook' })),
    getActionCommand: vi.fn(() => ({
      run: vi.fn(),
      preprocessVariable: undefined,
    })),
    getNextStep: vi.fn(() => null),
    $relatedQuery: vi.fn(() => null),
  }
  const flow = {
    id: 'flow-id',
    config: null as IFlowConfig | null,
    user: { email: 'test@example.com' },
    steps: [] as unknown[],
  }

  beforeAll(async () => {
    vi.resetModules()

    const makeActionQueueModule = await import(
      '@/queues/helpers/make-action-queue'
    )
    vi.spyOn(makeActionQueueModule, 'makeActionQueue').mockImplementation(
      ({ queueName }) => createMockQueue(queueName) as never,
    )

    actionQueueModule = await import('@/queues/action')

    const actionModule = await import('../action')
    processAction = actionModule.processAction
  })

  beforeEach(() => {
    flow.config = null
    executionStep.isFailed = false
    executionStep.status = 'success'

    spyOnLogger()

    spyOnStepQuery(() => ({
      findById: vi.fn(() => ({
        throwIfNotFound: vi.fn(() => step),
      })),
    }))

    vi.spyOn(Flow, 'query').mockImplementation(
      () =>
        ({
          findById: vi.fn(() => ({
            withGraphJoined: vi.fn(() => ({
              withGraphFetched: vi.fn(() => ({
                throwIfNotFound: vi.fn(() => flow),
              })),
            })),
          })),
        }) as never,
    )

    vi.spyOn(Execution, 'query').mockImplementation(
      () =>
        ({
          findById: vi.fn(() => ({
            throwIfNotFound: vi.fn(() => execution),
          })),
        }) as never,
    )

    const chainable: Record<string, unknown> = {}
    chainable.where = vi.fn(() => chainable)
    chainable.then = (onFulfilled: (value: unknown[]) => unknown) =>
      onFulfilled([])
    vi.spyOn(ExecutionStep, 'query').mockImplementation(() => chainable as never)

    vi.spyOn(computeForEachParameters, 'getStepContext').mockReturnValue({
      forEachStepPosition: -1,
      stepPositions: [],
      isForEachStep: false,
      isLastStep: false,
    })

    vi.spyOn(computeParametersModule, 'default').mockImplementation(
      () => ({}),
    )
    vi.spyOn(globalVariableModule, 'default').mockImplementation(
      () =>
        ({
          step: { parameters: {} },
          actionOutput: { data: null, error: null },
          execution: { id: 'execution-id' },
          app: { key: 'webhook' },
        }) as never,
    )
    vi.spyOn(getForEachMetadataModule, 'default').mockImplementation(vi.fn())
    vi.spyOn(actionQueueModule, 'enqueueActionJob').mockResolvedValue(
      {} as never,
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  afterAll(() => {
    vi.restoreAllMocks()
    process.removeAllListeners('SIGTERM')
  })

  describe('Force clogging', () => {
    it('throws an UnrecoverableError when flow.config.isForceClogged is true', async () => {
      flow.config = { isForceClogged: true }

      await expect(processAction(OPTIONS)).rejects.toThrow(
        'Pipe flow-id has been force clogged',
      )
    })

    it('does not throw UnrecoverableError when flow.config.isForceClogged is false', async () => {
      flow.config = { isForceClogged: false }

      const result = await processAction(OPTIONS)
      expect(result.executionError).toBeNull()
    })

    it('does not throw error when flow has no config', async () => {
      flow.config = null

      const result = await processAction(OPTIONS)
      expect(result.executionError).toBeNull()
    })
  })
})
