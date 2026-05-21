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

import { processAction } from '../action'

const mocks = vi.hoisted(() => ({
  computeParameters: vi.fn(),
  getForEachMetadata: vi.fn(),
  enqueueActionJob: vi.fn(),
}))

vi.mock('@/helpers/compute-parameters', () => ({
  default: mocks.computeParameters,
}))

vi.mock('@/services/helpers/get-for-each-metadata', () => ({
  default: mocks.getForEachMetadata,
}))

vi.mock('@/queues/action', () => ({
  enqueueActionJob: mocks.enqueueActionJob,
}))

vi.mock('@/helpers/logger', () => ({
  default: { error: vi.fn(), info: vi.fn() },
}))

describe('processAction - priorExecutionSteps filtering', () => {
  let flow: Flow
  let execution: Execution
  let actionBeforeStep: Step
  let forEachStep: Step
  let actionStep1: Step
  let actionStep2: Step

  beforeEach(async () => {
    vi.clearAllMocks()
    mocks.computeParameters.mockReturnValue({})

    const user = await User.query().findOne({ email: 'tester@open.gov.sg' })

    flow = await Flow.query().insertGraphAndFetch({
      userId: user.id,
      name: 'test-for-each-flow',
      steps: [
        {
          appKey: 'mock-app',
          key: 'mock-trigger',
          type: 'trigger',
          position: 1,
          status: 'completed',
        },
        {
          appKey: 'mock-app',
          key: 'mock-action-before',
          type: 'action',
          position: 2,
          status: 'completed',
        },
        {
          appKey: TOOLBOX_APP_KEY,
          key: TOOLBOX_ACTIONS.FOR_EACH,
          type: 'action',
          position: 3,
          status: 'completed',
        },
        {
          appKey: 'mock-app',
          key: 'mock-action-1',
          type: 'action',
          position: 4,
          status: 'completed',
        },
        {
          appKey: 'mock-app',
          key: 'mock-action-2',
          type: 'action',
          position: 5,
          status: 'completed',
        },
      ],
    })
    ;[, actionBeforeStep, forEachStep, actionStep1, actionStep2] = flow.steps

    execution = await Execution.query().insertAndFetch({
      flowId: flow.id,
      testRun: false,
    })

    vi.spyOn(Step.prototype, 'getApp').mockResolvedValue({
      key: 'mock-app',
      apiBaseUrl: null,
      beforeRequest: [],
      requestErrorHandler: null,
    } as any)

    vi.spyOn(Step.prototype, 'getActionCommand').mockResolvedValue({
      run: vi.fn().mockResolvedValue({}),
      preprocessVariable: undefined,
    } as any)

    vi.spyOn(Step.prototype, 'getNextStep').mockResolvedValue(null)
    vi.spyOn(Step.prototype, 'getTriggerCommand').mockResolvedValue({
      type: 'polling',
    } as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  async function insertExecutionStep(
    stepId: string,
    iteration?: number,
  ): Promise<ExecutionStep> {
    return ExecutionStep.query().insertAndFetch({
      executionId: execution.id,
      stepId,
      status: 'success',
      dataOut: {},
      ...(iteration !== undefined && { metadata: { iteration } }),
    })
  }

  it('fetches all execution steps when not inside a for-each', async () => {
    const actionBeforeExecStep = await insertExecutionStep(actionBeforeStep.id)
    const forEachExecStep = await insertExecutionStep(forEachStep.id)
    const action1Iter1 = await insertExecutionStep(actionStep1.id, 1)
    const action1Iter2 = await insertExecutionStep(actionStep1.id, 2)

    await processAction({
      flowId: flow.id,
      executionId: execution.id,
      stepId: actionBeforeStep.id,
    })

    const capturedSteps: ExecutionStep[] =
      mocks.computeParameters.mock.calls[0][1]
    const capturedIds = capturedSteps.map((s) => s.id).sort()

    expect(capturedIds).toEqual(
      [
        actionBeforeExecStep.id,
        forEachExecStep.id,
        action1Iter1.id,
        action1Iter2.id,
      ].sort(),
    )
  })

  it('fetches only null-iteration steps and same-iteration steps when inside for-each', async () => {
    const actionBeforeExecStep = await insertExecutionStep(actionBeforeStep.id)
    const forEachExecStep = await insertExecutionStep(forEachStep.id)
    const action1Iter1 = await insertExecutionStep(actionStep1.id, 1)
    const action1Iter2 = await insertExecutionStep(actionStep1.id, 2)
    const action1Iter3 = await insertExecutionStep(actionStep1.id, 3)

    await processAction({
      flowId: flow.id,
      executionId: execution.id,
      stepId: actionStep1.id,
      metadata: { iteration: 2 },
    })

    const capturedSteps: ExecutionStep[] =
      mocks.computeParameters.mock.calls[0][1]
    const capturedIds = capturedSteps.map((s) => s.id).sort()

    // trigger and for-each (no iteration) + action1 iteration 2 only
    expect(capturedIds).toEqual(
      [actionBeforeExecStep.id, forEachExecStep.id, action1Iter2.id].sort(),
    )
    expect(capturedIds).not.toContain(action1Iter1.id)
    expect(capturedIds).not.toContain(action1Iter3.id)
  })

  it('fetches only null-iteration steps when inside for-each with no iteration in metadata', async () => {
    const actionBeforeExecStep = await insertExecutionStep(actionBeforeStep.id)
    const forEachExecStep = await insertExecutionStep(forEachStep.id)
    const action1Iter1 = await insertExecutionStep(actionStep1.id, 1)

    await processAction({
      flowId: flow.id,
      executionId: execution.id,
      stepId: actionStep1.id,
    })

    const capturedSteps: ExecutionStep[] =
      mocks.computeParameters.mock.calls[0][1]
    const capturedIds = capturedSteps.map((s) => s.id).sort()

    expect(capturedIds).toEqual(
      [actionBeforeExecStep.id, forEachExecStep.id].sort(),
    )
    expect(capturedIds).not.toContain(action1Iter1.id)
  })

  it('fetches action1 steps only for the same iteration when processing action2', async () => {
    const actionBeforeExecStep = await insertExecutionStep(actionBeforeStep.id)
    const forEachExecStep = await insertExecutionStep(forEachStep.id)
    // action1 has run for iterations 1, 2, and 3
    const action1Iter1 = await insertExecutionStep(actionStep1.id, 1)
    const action1Iter2 = await insertExecutionStep(actionStep1.id, 2)
    const action1Iter3 = await insertExecutionStep(actionStep1.id, 3)

    // now processing action2 for iteration 2
    await processAction({
      flowId: flow.id,
      executionId: execution.id,
      stepId: actionStep2.id,
      metadata: { iteration: 2 },
    })

    const capturedSteps: ExecutionStep[] =
      mocks.computeParameters.mock.calls[0][1]
    const capturedIds = capturedSteps.map((s) => s.id).sort()

    // action2 should see: trigger, for-each, and action1 iter 2 only
    expect(capturedIds).toEqual(
      [actionBeforeExecStep.id, forEachExecStep.id, action1Iter2.id].sort(),
    )
    expect(capturedIds).not.toContain(action1Iter1.id)
    expect(capturedIds).not.toContain(action1Iter3.id)
  })
})
