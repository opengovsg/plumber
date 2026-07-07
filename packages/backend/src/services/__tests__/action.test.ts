import { IFlowConfig } from '@plumber/types'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { processAction } from '../action'

const mocks = vi.hoisted(() => {
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

  return {
    step,
    flow,
    execution,
    executionStep,
    globalVariable: vi.fn(() => ({
      step: { parameters: {} },
      actionOutput: { data: null, error: null },
      execution: { id: 'execution-id' },
      app: { key: 'webhook' },
    })),
  }
})

vi.mock('@/models/step', () => ({
  default: {
    query: vi.fn(() => ({
      findById: vi.fn(() => ({
        throwIfNotFound: vi.fn(() => mocks.step),
      })),
    })),
  },
}))

vi.mock('@/models/flow', () => ({
  default: {
    query: vi.fn(() => ({
      findById: vi.fn(() => ({
        withGraphJoined: vi.fn(() => ({
          withGraphFetched: vi.fn(() => ({
            throwIfNotFound: vi.fn(() => mocks.flow),
          })),
        })),
      })),
    })),
  },
}))

vi.mock('@/models/execution', () => ({
  default: {
    query: vi.fn(() => ({
      findById: vi.fn(() => ({
        throwIfNotFound: vi.fn(() => mocks.execution),
      })),
    })),
  },
}))

vi.mock('@/models/execution-step', () => {
  const chainable: Record<string, unknown> = {}
  chainable.where = vi.fn(() => chainable)
  chainable.then = (onFulfilled: (value: unknown[]) => unknown) =>
    onFulfilled([])
  return {
    default: {
      query: vi.fn(() => chainable),
    },
  }
})

vi.mock('@/helpers/compute-for-each-parameters', () => ({
  getStepContext: vi.fn(() => ({
    forEachStepPosition: -1,
    stepPositions: [],
    isForEachStep: false,
    isLastStep: false,
  })),
}))

vi.mock('@/helpers/compute-parameters', () => ({
  default: vi.fn(() => ({})),
}))

vi.mock('@/helpers/global-variable', () => ({
  default: mocks.globalVariable,
}))

vi.mock('@/helpers/logger', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

vi.mock('@/services/helpers/get-for-each-metadata', () => ({
  default: vi.fn(),
}))

vi.mock('@/queues/action', () => ({
  enqueueActionJob: vi.fn(),
}))

const OPTIONS = {
  flowId: 'flow-id',
  stepId: 'step-id',
  executionId: 'execution-id',
}

describe('processAction', () => {
  beforeEach(() => {
    mocks.flow.config = null
    mocks.executionStep.isFailed = false
    mocks.executionStep.status = 'success'
  })

  describe('Force clogging', () => {
    it('throws an UnrecoverableError when flow.config.isForceClogged is true', async () => {
      mocks.flow.config = { isForceClogged: true }

      await expect(processAction(OPTIONS)).rejects.toThrow(
        'Pipe flow-id has been force clogged',
      )
    })

    it('does not throw UnrecoverableError when flow.config.isForceClogged is false', async () => {
      mocks.flow.config = { isForceClogged: false }

      const result = await processAction(OPTIONS)
      expect(result.executionError).toBeNull()
    })

    it('does not throw error when flow has no config', async () => {
      mocks.flow.config = null

      const result = await processAction(OPTIONS)
      expect(result.executionError).toBeNull()
    })
  })
})
