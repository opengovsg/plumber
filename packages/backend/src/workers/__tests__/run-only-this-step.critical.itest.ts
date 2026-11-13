/**
 * Business rule: "retry a successful job without running the rest of the pipe".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  TOOLBOX_ACTIONS,
  TOOLBOX_APP_KEY,
} from '@/apps/toolbox/common/constants'
import Execution from '@/models/execution'
import ExecutionStep from '@/models/execution-step'
import Flow from '@/models/flow'
import Step from '@/models/step'
import User from '@/models/user'
import * as actionQueueModule from '@/queues/action'
import { processAction } from '@/services/action'
import { spyOnLogger } from '@/test/spy-on-logger'
import { advanceAfterStep } from '@/workers/helpers/advance-after-step'

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

  describe('advanceAfterStep', () => {
    const context = {
      isQueueDelayable: false,
      span: {} as never,
      worker: {} as never,
      job: {} as never,
    }

    async function insertExecutionStep(
      step: Step,
      status: 'success' | 'failure',
      metadata: Record<string, unknown> = {},
      createdAt?: string,
    ): Promise<ExecutionStep> {
      return ExecutionStep.query().insertAndFetch({
        executionId: execution.id,
        stepId: step.id,
        appKey: step.appKey,
        key: step.key,
        status,
        dataOut: {},
        metadata,
        ...(createdAt && { createdAt }),
      })
    }

    async function advance(
      executionStep: ExecutionStep,
      nextStepMetadata: Record<string, unknown> = {},
    ): Promise<void> {
      await advanceAfterStep({
        processResult: {
          flowId: flow.id,
          executionId: execution.id,
          nextStep: actionStep2,
          executionStep,
          nextStepMetadata,
          executionError: null,
          runOnlyThisStep: true,
        },
        currStep: actionStep1,
        context,
      })
    }

    beforeEach(async () => {
      await execution.$query().patch({ status: null })
    })

    it('does not enqueue the next step', async () => {
      const executionStep = await insertExecutionStep(actionStep1, 'success')

      await advance(executionStep)

      expect(enqueueActionJobSpy).not.toHaveBeenCalled()
    })

    it('marks the execution as successful', async () => {
      const executionStep = await insertExecutionStep(actionStep1, 'success')

      await advance(executionStep)

      expect((await execution.$query()).status).toBe('success')
    })

    it('keeps the execution failed when another step failed', async () => {
      await insertExecutionStep(actionStep2, 'failure')
      const executionStep = await insertExecutionStep(actionStep1, 'success')

      await advance(executionStep)

      expect((await execution.$query()).status).toBe('failure')
    })

    it('settles a for-each iteration from a step that is not last in the loop', async () => {
      await insertExecutionStep(forEachStep, 'success', {
        iterationStatus: { iteration_1: 'success', iteration_2: null },
      })
      await insertExecutionStep(actionStep1, 'success', { iteration: 1 })
      await insertExecutionStep(actionStep2, 'success', { iteration: 1 })
      await insertExecutionStep(
        actionStep1,
        'failure',
        { iteration: 2 },
        '2026-01-01T00:00:00Z',
      )
      await insertExecutionStep(actionStep2, 'success', { iteration: 2 })
      const executionStep = await insertExecutionStep(actionStep1, 'success', {
        iteration: 2,
      })

      await advance(executionStep, { iteration: 2 })

      const forEachExecutionStep = await ExecutionStep.query().findOne({
        execution_id: execution.id,
        step_id: forEachStep.id,
      })
      expect(forEachExecutionStep.metadata.iterationStatus).toEqual({
        iteration_1: 'success',
        iteration_2: 'success',
      })
      expect((await execution.$query()).status).toBe('success')
    })

    it('keeps a for-each iteration failed when another step in it failed', async () => {
      await insertExecutionStep(forEachStep, 'success', {
        iterationStatus: { iteration_1: null },
      })
      await insertExecutionStep(actionStep2, 'failure', { iteration: 1 })
      const executionStep = await insertExecutionStep(actionStep1, 'success', {
        iteration: 1,
      })

      await advance(executionStep, { iteration: 1 })

      const forEachExecutionStep = await ExecutionStep.query().findOne({
        execution_id: execution.id,
        step_id: forEachStep.id,
      })
      expect(forEachExecutionStep.metadata.iterationStatus).toEqual({
        iteration_1: 'failure',
      })
      expect((await execution.$query()).status).toBe('failure')
    })
  })
})
