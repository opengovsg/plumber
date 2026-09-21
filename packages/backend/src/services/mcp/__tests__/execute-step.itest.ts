import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import apps from '@/apps'
import { getStepVersion } from '@/helpers/get-step-version'
import Execution from '@/models/execution'
import Flow from '@/models/flow'
import Step from '@/models/step'
import User from '@/models/user'

import { createFlowWithStepsService } from '../create-flow-with-steps'
import { executeStepService } from '../execute-step'

const mocks = vi.hoisted(() => ({
  testStep: vi.fn(),
  getAllLdFlags: vi.fn(),
  getRestrictedAppKeys: vi.fn(),
}))

vi.mock('@/services/test-step', () => ({
  default: mocks.testStep,
}))

vi.mock('@/helpers/launch-darkly', () => ({
  getAllLdFlags: mocks.getAllLdFlags,
  getRestrictedAppKeys: mocks.getRestrictedAppKeys,
}))

const makeExecutionStep = (
  overrides: Partial<{
    id: string
    status: 'success' | 'failure'
    dataOut: Record<string, unknown> | null
    errorDetails: Record<string, unknown> | null
  }> = {},
) => {
  const base: {
    id: string
    status: 'success' | 'failure'
    dataOut: Record<string, unknown> | null
    errorDetails: Record<string, unknown> | null
  } = {
    id: randomUUID(),
    status: 'success',
    dataOut: { submissionId: 'abc123' },
    errorDetails: null,
    ...overrides,
  }
  return {
    ...base,
    get isFailed() {
      return this.status === 'failure'
    },
  }
}

describe('executeStepService', () => {
  let user: User
  let flow: Awaited<ReturnType<typeof createFlowWithStepsService>>

  beforeEach(async () => {
    mocks.getAllLdFlags.mockResolvedValue({})
    mocks.getRestrictedAppKeys.mockReturnValue([])

    user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `execute-step-${randomUUID()}@example.com`,
    })

    flow = await createFlowWithStepsService({
      user,
      name: 'Test Pipe',
      steps: [
        {
          appKey: 'formsg',
          key: 'newSubmission',
          type: 'trigger',
          position: 1,
        },
        {
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          type: 'action',
          position: 2,
        },
      ],
      traceId: 'trace-execute-1',
    })
  })

  it('marks step as completed and returns success:true when testStep succeeds', async () => {
    const actionStep = flow.steps.find((s) => s.type === 'action')
    expect(actionStep).toBeDefined()

    const execution = await Execution.query().insertAndFetch({
      id: randomUUID(),
      flowId: flow.id,
    })
    const execStep = makeExecutionStep({ dataOut: { output: 'data' } })
    mocks.testStep.mockResolvedValueOnce({
      executionStep: execStep,
      executionId: execution.id,
    })

    const result = await executeStepService(user, actionStep.id)

    expect(result).toMatchObject({
      success: true,
      pipeId: flow.id,
      stepId: actionStep.id,
      executionStepId: execStep.id,
      dataOut: { output: 'data' },
      errorDetails: null,
    })
    // postman's sendTransactionalEmail declares a getDataOutMetadata that
    // tags `recipient`/`status`/`cc` as 'array' typed outputs.
    expect(result.dataOutMetadata).toMatchObject({
      recipient: { type: 'array' },
      status: { type: 'array' },
      cc: { type: 'array' },
    })

    const updated = await Step.query().findById(actionStep.id)
    expect(updated.status).toBe('completed')

    const updatedFlow = await Flow.query().findById(flow.id)
    expect(updatedFlow.testExecutionId).toBe(execution.id)

    expect(mocks.testStep).toHaveBeenCalledWith({
      stepId: actionStep.id,
      testRunMetadata: { preferMock: true },
    })
  })

  it('does not mark step as completed and returns success:false when testStep fails', async () => {
    const actionStep = flow.steps.find((s) => s.type === 'action')

    const execution = await Execution.query().insertAndFetch({
      id: randomUUID(),
      flowId: flow.id,
    })
    const execStep = makeExecutionStep({
      status: 'failure',
      dataOut: null,
      errorDetails: { message: 'Invalid credentials' },
    })
    mocks.testStep.mockResolvedValueOnce({
      executionStep: execStep,
      executionId: execution.id,
    })

    const result = await executeStepService(user, actionStep.id)

    expect(result.success).toBe(false)
    expect(result.errorDetails).toMatchObject({
      message: 'Invalid credentials',
    })
    // dataOut is null, so getDataOutMetadata has nothing to tag types for.
    expect(result.dataOutMetadata).toBeNull()

    const unchanged = await Step.query().findById(actionStep.id)
    expect(unchanged.status).not.toBe('completed')
  })

  it('returns dataOutMetadata:null (instead of throwing) when getDataOutMetadata fails', async () => {
    const actionStep = flow.steps.find((s) => s.type === 'action')

    const execution = await Execution.query().insertAndFetch({
      id: randomUUID(),
      flowId: flow.id,
    })
    const execStep = makeExecutionStep({ dataOut: { output: 'data' } })
    mocks.testStep.mockResolvedValueOnce({
      executionStep: execStep,
      executionId: execution.id,
    })

    const sendEmailAction = apps.postman.actions.find(
      (a) => a.key === 'sendTransactionalEmail',
    )
    const getDataOutMetadataSpy = vi
      .spyOn(sendEmailAction, 'getDataOutMetadata')
      .mockRejectedValueOnce(new Error('schema mismatch'))

    const result = await executeStepService(user, actionStep.id)

    expect(result.success).toBe(true)
    expect(result.dataOutMetadata).toBeNull()

    getDataOutMetadataSpy.mockRestore()
  })

  it('throws if the pipe is active', async () => {
    await Flow.knex()
      .table('flows')
      .where('id', flow.id)
      .update({ active: true })

    const anyStep = flow.steps[0]
    await expect(executeStepService(user, anyStep.id)).rejects.toThrow(
      'This pipe is published. Ask the user to unpublish it before making changes.',
    )
  })

  it('throws if the step does not belong to the user', async () => {
    const otherUser = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `other-user-${randomUUID()}@example.com`,
    })

    const anyStep = flow.steps[0]
    await expect(executeStepService(otherUser, anyStep.id)).rejects.toThrow()
  })
  describe('MRF forms', () => {
    let triggerId: string
    let stageIds: string[]
    let executionId: string

    const succeeds = () =>
      ({ executionStep: makeExecutionStep(), executionId } as never)
    const fails = () =>
      ({
        executionStep: makeExecutionStep({
          status: 'failure',
          errorDetails: { error: 'boom' },
        }),
        executionId,
      } as never)
    const statusOf = async (id: string) =>
      (await Step.query().findById(id)).status

    beforeEach(async () => {
      mocks.testStep.mockReset()
      const trigger = flow.steps.find((s) => s.type === 'trigger')
      triggerId = trigger.id
      await trigger.$query().patch({
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
          parameters: { mrf: { defaultStepName: name } },
          config: { stepName: name },
          version: getStepVersion('formsg', 'mrfSubmission'),
        })
        stageIds.push(stage.id)
      }
      executionId = (
        await Execution.query().insertAndFetch({
          id: randomUUID(),
          flowId: flow.id,
        })
      ).id
    })

    it('completes every stage step once the trigger passes', async () => {
      mocks.testStep.mockImplementation(async () => succeeds())

      await executeStepService(user, triggerId)

      expect(mocks.testStep.mock.calls.map(([arg]) => arg.stepId)).toEqual([
        triggerId,
        ...stageIds,
      ])
      for (const id of [triggerId, ...stageIds]) {
        expect(await statusOf(id)).toBe('completed')
      }
    })

    it('starts from the trigger when a stage step is tested', async () => {
      mocks.testStep.mockImplementation(async () => succeeds())

      const result = await executeStepService(user, stageIds[1])

      expect(mocks.testStep.mock.calls[0][0].stepId).toBe(triggerId)
      expect(result.stepId).toBe(triggerId)
      expect(await statusOf(stageIds[0])).toBe('completed')
    })

    it('stops at the first stage step that fails', async () => {
      mocks.testStep
        .mockImplementationOnce(async () => succeeds())
        .mockImplementationOnce(async () => fails())

      await executeStepService(user, triggerId)

      expect(await statusOf(triggerId)).toBe('completed')
      expect(await statusOf(stageIds[0])).not.toBe('completed')
      expect(await statusOf(stageIds[1])).not.toBe('completed')
      expect(mocks.testStep).toHaveBeenCalledTimes(2)
    })

    it('leaves the stage steps alone when the trigger fails', async () => {
      mocks.testStep.mockImplementation(async () => fails())

      const result = await executeStepService(user, triggerId)

      expect(result.success).toBe(false)
      expect(mocks.testStep).toHaveBeenCalledTimes(1)
      expect(await statusOf(stageIds[0])).not.toBe('completed')
    })
  })
})
