import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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

    const updated = await Step.query().findById(actionStep.id)
    expect(updated.status).toBe('completed')
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

    const unchanged = await Step.query().findById(actionStep.id)
    expect(unchanged.status).not.toBe('completed')
  })

  it('throws if the pipe is active', async () => {
    await Flow.knex()
      .table('flows')
      .where('id', flow.id)
      .update({ active: true })

    const anyStep = flow.steps[0]
    await expect(executeStepService(user, anyStep.id)).rejects.toThrow(
      'Cannot test a step in an active pipe',
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
})
