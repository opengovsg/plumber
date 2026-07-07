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
  }
})

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
