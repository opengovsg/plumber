import { IFlowConfig } from '@plumber/types'
import { UnrecoverableError } from '@taskforcesh/bullmq-pro'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import Execution from '@/models/execution'
import * as shouldTriggerProceedModule from '@/services/helpers/should-trigger-proceed'
import { spyOnStepQuery } from '@/test/spy-on-step-query'

import { processTrigger } from '../trigger'

describe('processTrigger', () => {
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

  const step = {
    id: 'step-id',
    appKey: 'webhook',
    parameters: {},
    key: 'new-submission',
    config: {},
    flow,
  }

  const shouldTriggerProceed = vi.fn(() => ({ shouldExecute: true }))

  beforeEach(() => {
    flow.config = null
    shouldTriggerProceed.mockReturnValue({ shouldExecute: true })

    spyOnStepQuery(() => ({
      findById: vi.fn(() => ({
        withGraphFetched: vi.fn(() => ({
          throwIfNotFound: vi.fn(() => step),
        })),
      })),
    }))

    vi.spyOn(
      shouldTriggerProceedModule,
      'shouldTriggerProceed',
    ).mockImplementation(shouldTriggerProceed)

    vi.spyOn(Execution, 'query').mockImplementation(
      () =>
        ({
          insert: vi.fn(() => ({
            onConflict: vi.fn(() => ({
              ignore: vi.fn(() => execution),
            })),
          })),
        }) as never,
    )
    vi.spyOn(Execution, 'transaction').mockImplementation((callback) =>
      (callback as (trx: string) => unknown)('mock-trx'),
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Force clogging', () => {
    it('throws UnrecoverableError when flow.config.isForceClogged is true', async () => {
      flow.config = { isForceClogged: true }

      await expect(
        processTrigger({ flowId: 'flow-id', stepId: 'step-id' }),
      ).rejects.toThrow(UnrecoverableError)
    })

    it('does not throw when flow.config.isForceClogged is false', async () => {
      flow.config = { isForceClogged: false }

      await expect(
        processTrigger({ flowId: 'flow-id', stepId: 'step-id' }),
      ).resolves.toMatchObject({ shouldExecute: true })
    })

    it('does not throw when flow has no config', async () => {
      flow.config = null

      await expect(
        processTrigger({ flowId: 'flow-id', stepId: 'step-id' }),
      ).resolves.toMatchObject({ shouldExecute: true })
    })
  })
})
