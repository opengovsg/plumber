import { IFlowConfig } from '@plumber/types'
import { UnrecoverableError } from '@taskforcesh/bullmq-pro'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { processTrigger } from '../trigger'

const mocks = vi.hoisted(() => {
  const executionStep = { id: 'exec-step-id', isFailed: false }
  const execution = {
    id: 'execution-id',
    $relatedQuery: vi.fn(() => ({
      insertAndFetch: vi.fn(() => ({
        onConflict: vi.fn(() => ({
          ignore: vi.fn(() => executionStep),
        })),
      })),
    })),
  }

  const flow = {
    id: 'flow-id',
    config: null as IFlowConfig | null,
  }

  return {
    step: {
      id: 'step-id',
      appKey: 'webhook',
      parameters: {},
      key: 'new-submission',
      config: {},
      flow,
    },
    flow,
    execution,
    shouldTriggerProceed: vi.fn(() => ({ shouldExecute: true })),
    incrementMetric: vi.fn(),
  }
})

vi.mock('@/helpers/metrics', () => ({
  incrementMetric: mocks.incrementMetric,
}))

vi.mock('@/models/step', () => ({
  default: {
    query: vi.fn(() => ({
      findById: vi.fn(() => ({
        withGraphFetched: vi.fn(() => ({
          throwIfNotFound: vi.fn(() => mocks.step),
        })),
      })),
    })),
  },
}))

vi.mock('@/services/helpers/should-trigger-proceed', () => ({
  shouldTriggerProceed: mocks.shouldTriggerProceed,
}))

vi.mock('@/models/execution', () => ({
  default: {
    query: vi.fn(() => ({
      insert: vi.fn(() => ({
        onConflict: vi.fn(() => ({
          ignore: vi.fn(() => mocks.execution),
        })),
      })),
    })),
    transaction: vi.fn((callback) => callback('mock-trx')),
  },
}))

describe('processTrigger', () => {
  beforeEach(() => {
    mocks.flow.config = null
    mocks.incrementMetric.mockClear()
  })

  describe('execution end count', () => {
    function getCountedOutcomes(): string[] {
      return mocks.incrementMetric.mock.calls
        .filter(([name]) => name === 'plumber.executions.ended')
        .map(([, tags]) => tags.outcome)
    }

    it.each([
      { label: 'the saved kind', error: { kind: 'config' }, outcome: 'config' },
      {
        label: 'internal without a kind',
        error: { error: 'boom' },
        outcome: 'internal',
      },
    ])('counts a trigger error with $label', async ({ error, outcome }) => {
      await processTrigger({ flowId: 'flow-id', stepId: 'step-id', error })

      expect(getCountedOutcomes()).toEqual([outcome])
    })

    it('does not count a trigger error in a test run', async () => {
      await processTrigger({
        flowId: 'flow-id',
        stepId: 'step-id',
        error: { kind: 'config' },
        testRun: true,
      })

      expect(getCountedOutcomes()).toEqual([])
    })

    it('does not count a trigger without an error', async () => {
      await processTrigger({ flowId: 'flow-id', stepId: 'step-id' })

      expect(getCountedOutcomes()).toEqual([])
    })
  })

  describe('Force clogging', () => {
    it('throws UnrecoverableError when flow.config.isForceClogged is true', async () => {
      mocks.flow.config = { isForceClogged: true }

      await expect(
        processTrigger({ flowId: 'flow-id', stepId: 'step-id' }),
      ).rejects.toThrow(UnrecoverableError)
    })

    it('does not throw when flow.config.isForceClogged is false', async () => {
      mocks.flow.config = { isForceClogged: false }

      await expect(
        processTrigger({ flowId: 'flow-id', stepId: 'step-id' }),
      ).resolves.toMatchObject({ shouldExecute: true })
    })

    it('does not throw when flow has no config', async () => {
      mocks.flow.config = null

      await expect(
        processTrigger({ flowId: 'flow-id', stepId: 'step-id' }),
      ).resolves.toMatchObject({ shouldExecute: true })
    })
  })
})
