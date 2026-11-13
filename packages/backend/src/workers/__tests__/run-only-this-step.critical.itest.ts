/**
 * Business rule: "retry a successful job without running the rest of the pipe".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  TOOLBOX_ACTIONS,
  TOOLBOX_APP_KEY,
} from '@/apps/toolbox/common/constants'
import Execution from '@/models/execution'
import Flow from '@/models/flow'
import Step from '@/models/step'
import User from '@/models/user'
import * as actionQueueModule from '@/queues/action'
import { processAction } from '@/services/action'
import { spyOnLogger } from '@/test/spy-on-logger'

describe('runOnlyThisStep', () => {
  let flow: Flow
  let execution: Execution
  let forEachStep: Step
  let actionStep1: Step
  let actionStep2: Step
  let enqueueActionJobSpy: ReturnType<typeof vi.spyOn>

  beforeEach(async () => {
    enqueueActionJobSpy = vi
      .spyOn(actionQueueModule, 'enqueueActionJob')
      .mockResolvedValue(undefined as never)
    spyOnLogger()

    const user = await User.query().findOne({ email: 'tester@open.gov.sg' })

    flow = await Flow.query().insertGraphAndFetch({
      userId: user.id,
      name: 'run-only-this-step-flow',
      steps: [
        {
          appKey: 'mock-app',
          key: 'mock-trigger',
          type: 'trigger',
          position: 1,
          status: 'completed',
        },
        {
          appKey: TOOLBOX_APP_KEY,
          key: TOOLBOX_ACTIONS.FOR_EACH,
          type: 'action',
          position: 2,
          status: 'completed',
        },
        {
          appKey: 'mock-app',
          key: 'mock-action-1',
          type: 'action',
          position: 3,
          status: 'completed',
        },
        {
          appKey: 'mock-app',
          key: 'mock-action-2',
          type: 'action',
          position: 4,
          status: 'completed',
        },
      ],
    })
    ;[, forEachStep, actionStep1, actionStep2] = flow.steps

    execution = await Execution.query().insertAndFetch({
      flowId: flow.id,
      testRun: false,
      status: 'success',
    })

    vi.spyOn(Step.prototype, 'getApp').mockResolvedValue({
      key: 'mock-app',
      apiBaseUrl: null,
      beforeRequest: [],
      requestErrorHandler: null,
    } as never)
    vi.spyOn(Step.prototype, 'getNextStep').mockResolvedValue(actionStep2)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('processAction', () => {
    it('resolves no next step', async () => {
      vi.spyOn(Step.prototype, 'getActionCommand').mockResolvedValue({
        run: vi.fn().mockResolvedValue({}),
      } as never)

      const result = await processAction({
        flowId: flow.id,
        executionId: execution.id,
        stepId: actionStep1.id,
        runOnlyThisStep: true,
      })

      expect(result.executionStep.status).toBe('success')
      expect(result.nextStep).toBeNull()
    })

    it('does not start for-each iterations', async () => {
      vi.spyOn(Step.prototype, 'getActionCommand').mockResolvedValue({
        run: vi.fn(async ($) => {
          $.setActionItem({ raw: { iterations: 2 } })
          return { nextStep: { command: 'start-for-each' } }
        }),
      } as never)

      await processAction({
        flowId: flow.id,
        executionId: execution.id,
        stepId: forEachStep.id,
        runOnlyThisStep: true,
      })

      expect(enqueueActionJobSpy).not.toHaveBeenCalled()
    })
  })
})
