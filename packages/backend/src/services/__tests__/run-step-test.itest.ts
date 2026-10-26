import { randomUUID } from 'crypto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import Execution from '@/models/execution'
import Flow from '@/models/flow'
import Step from '@/models/step'
import User from '@/models/user'

import { runStepTest } from '../run-step-test'

const mocks = vi.hoisted(() => ({
  testStep: vi.fn(),
}))

vi.mock('@/services/test-step', () => ({
  default: mocks.testStep,
}))

const makeExecutionStep = (
  overrides: Partial<{
    id: string
    status: 'success' | 'failure'
    dataOut: Record<string, unknown> | null
    errorDetails: Record<string, unknown> | null
  }> = {},
) => {
  const base = {
    id: randomUUID(),
    status: 'success' as 'success' | 'failure',
    dataOut: { output: 'data' } as Record<string, unknown> | null,
    errorDetails: null as Record<string, unknown> | null,
    ...overrides,
  }
  return {
    ...base,
    get isFailed() {
      return this.status === 'failure'
    },
  }
}

describe('runStepTest', () => {
  let user: User
  let flow: Flow
  let trigger: Step
  let action: Step

  beforeEach(async () => {
    mocks.testStep.mockReset()
    user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `run-step-test-${randomUUID()}@example.com`,
    })
    flow = await Flow.query().insertGraphAndFetch({
      userId: user.id,
      name: 'Run step test',
      steps: [
        {
          key: 'newSubmission',
          appKey: 'formsg',
          type: 'trigger',
          position: 1,
          status: 'incomplete',
          parameters: {},
        },
        {
          key: 'sendTransactionalEmail',
          appKey: 'postman',
          type: 'action',
          position: 2,
          status: 'incomplete',
          parameters: {},
          config: {
            templateConfig: { appEventKey: 'draft' },
            stepName: 'Keep me',
          },
        },
      ],
    })
    trigger = flow.steps.find((step) => step.type === 'trigger')
    action = flow.steps.find((step) => step.type === 'action')
  })

  async function insertExecution(): Promise<Execution> {
    return Execution.query().insertAndFetch({
      id: randomUUID(),
      flowId: flow.id,
      testRun: true,
    })
  }

  it('marks a passing step completed and clears templateConfig', async () => {
    const execution = await insertExecution()
    const executionStep = makeExecutionStep()
    mocks.testStep.mockResolvedValueOnce({
      executionStep,
      executionId: execution.id,
    })

    const result = await runStepTest({
      step: action,
      testRunMetadata: { sample: true },
    })

    expect(result.step.id).toBe(action.id)
    expect(result.executionStep).toBe(executionStep)
    expect(result.stageResults).toEqual([])
    expect(mocks.testStep).toHaveBeenCalledWith({
      stepId: action.id,
      testRunMetadata: { sample: true },
    })

    const updated = await Step.query().findById(action.id)
    expect(updated.status).toBe('completed')
    expect(updated.config).toEqual({ stepName: 'Keep me' })

    const updatedFlow = await Flow.query().findById(flow.id)
    expect(updatedFlow.testExecutionId).toBe(execution.id)
  })

  it('leaves a failing step incomplete', async () => {
    const execution = await insertExecution()
    const executionStep = makeExecutionStep({
      status: 'failure',
      dataOut: null,
      errorDetails: { message: 'nope' },
    })
    mocks.testStep.mockResolvedValueOnce({
      executionStep,
      executionId: execution.id,
    })

    const result = await runStepTest({ step: action })

    expect(result.step.id).toBe(action.id)
    expect(result.executionStep).toBe(executionStep)
    expect(result.stageResults).toEqual([])
    expect(mocks.testStep).toHaveBeenCalledTimes(1)

    const unchanged = await Step.query().findById(action.id)
    expect(unchanged.status).toBe('incomplete')
    expect(unchanged.config).toEqual({
      templateConfig: { appEventKey: 'draft' },
      stepName: 'Keep me',
    })

    const updatedFlow = await Flow.query().findById(flow.id)
    expect(updatedFlow.testExecutionId).toBe(execution.id)
  })

  describe('MRF forms', () => {
    let stageIds: string[]

    beforeEach(async () => {
      trigger = await trigger.$query().patchAndFetch({
        parameters: { mrf: { defaultStepName: 'Requestor' } },
      })
      stageIds = []
      for (const [index, name] of ['Approval', 'Final'].entries()) {
        const stage = await Step.query().insertAndFetch({
          flowId: flow.id,
          type: 'action',
          appKey: 'formsg',
          key: 'mrfSubmission',
          position: 10 + index,
          status: 'incomplete',
          parameters: { mrf: { defaultStepName: name } },
          config: { stepName: name },
        })
        stageIds.push(stage.id)
      }
    })

    it('redirects an MRF stage to its trigger', async () => {
      const execution = await insertExecution()
      mocks.testStep.mockImplementation(async () => ({
        executionStep: makeExecutionStep(),
        executionId: execution.id,
      }))
      const stage = await Step.query().findById(stageIds[1])

      const result = await runStepTest({
        step: stage,
        testRunMetadata: { preferMock: true },
      })

      expect(result.step.id).toBe(trigger.id)
      expect(mocks.testStep.mock.calls.map(([arg]) => arg.stepId)).toEqual([
        trigger.id,
        ...stageIds,
      ])
      expect(
        mocks.testStep.mock.calls.map(([arg]) => arg.testRunMetadata),
      ).toEqual([
        { preferMock: true },
        { preferMock: true },
        { preferMock: true },
      ])
      for (const id of [trigger.id, ...stageIds]) {
        expect((await Step.query().findById(id)).status).toBe('completed')
      }
    })

    it('skips stages when the trigger fails', async () => {
      const execution = await insertExecution()
      mocks.testStep.mockResolvedValueOnce({
        executionStep: makeExecutionStep({
          status: 'failure',
          errorDetails: { error: 'boom' },
        }),
        executionId: execution.id,
      })

      const result = await runStepTest({ step: trigger })

      expect(result.step.id).toBe(trigger.id)
      expect(result.stageResults).toEqual([])
      expect(mocks.testStep).toHaveBeenCalledTimes(1)
      expect((await Step.query().findById(trigger.id)).status).toBe(
        'incomplete',
      )
      expect((await Step.query().findById(stageIds[0])).status).toBe(
        'incomplete',
      )
      expect((await Step.query().findById(stageIds[1])).status).toBe(
        'incomplete',
      )
    })

    it('stops when a stage fails', async () => {
      const execution = await insertExecution()
      mocks.testStep
        .mockResolvedValueOnce({
          executionStep: makeExecutionStep(),
          executionId: execution.id,
        })
        .mockResolvedValueOnce({
          executionStep: makeExecutionStep({
            status: 'failure',
            errorDetails: { error: 'boom' },
          }),
          executionId: execution.id,
        })

      const result = await runStepTest({ step: trigger })

      expect(result.step.id).toBe(trigger.id)
      expect(result.stageResults).toHaveLength(1)
      expect(result.stageResults[0].step.id).toBe(stageIds[0])
      expect(result.stageResults[0].executionStep.isFailed).toBe(true)
      expect(mocks.testStep).toHaveBeenCalledTimes(2)
      expect((await Step.query().findById(trigger.id)).status).toBe('completed')
      expect((await Step.query().findById(stageIds[0])).status).toBe(
        'incomplete',
      )
      expect((await Step.query().findById(stageIds[1])).status).toBe(
        'incomplete',
      )
    })
  })
})
