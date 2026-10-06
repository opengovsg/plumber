import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createMrfActionStep,
  createMrfTriggerStep,
  createRejectBranchStep,
  generateMockContext,
  generateMockFlow,
} from '@/apps/formsg/__tests__/mrf.mock'
import User from '@/models/user'

import { createFlowWithStepsService } from '../create-flow-with-steps'
import { getFlowService } from '../get-flow'

const mocks = vi.hoisted(() => ({
  getAllLdFlags: vi.fn(),
  getRestrictedAppKeys: vi.fn(),
}))

vi.mock('@/helpers/launch-darkly', () => ({
  getAllLdFlags: mocks.getAllLdFlags,
  getRestrictedAppKeys: mocks.getRestrictedAppKeys,
}))

describe('getFlowService', () => {
  beforeEach(() => {
    mocks.getAllLdFlags.mockResolvedValue({})
    mocks.getRestrictedAppKeys.mockReturnValue([])
  })

  it('returns flow metadata and steps in position order', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `get-flow-basic-${randomUUID()}@example.com`,
    })

    const flow = await createFlowWithStepsService({
      user,
      name: 'My Pipe',
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
      traceId: 'trace-get-flow-1',
    })

    const result = await getFlowService({ user, pipeId: flow.id })

    expect(result.id).toBe(flow.id)
    expect(result.name).toBe('My Pipe')
    expect(result.active).toBe(false)
    expect(result.steps.map((s) => s.appKey)).toEqual(['formsg', 'postman'])
    expect(result.steps.map((s) => s.position)).toEqual([1, 2])
  })

  it('throws when the pipe does not belong to the requesting user', async () => {
    const owner = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `get-flow-owner-${randomUUID()}@example.com`,
    })
    const intruder = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `get-flow-intruder-${randomUUID()}@example.com`,
    })
    const flow = await createFlowWithStepsService({
      user: owner,
      name: 'Owned Pipe',
      steps: [
        {
          appKey: 'formsg',
          key: 'newSubmission',
          type: 'trigger',
          position: 1,
        },
      ],
      traceId: 'trace-get-flow-2',
    })

    await expect(
      getFlowService({ user: intruder, pipeId: flow.id }),
    ).rejects.toThrow()
  })

  it('surfaces hidden MRF steps with their raw config and parameters', async () => {
    const context = await generateMockContext()
    const flowId = randomUUID()
    await generateMockFlow(context, flowId)
    await createMrfTriggerStep({ context, flowId })
    const approvalStep = await createMrfActionStep({
      context,
      flowId,
      position: 2,
      approvalField: 'approval_field',
      defaultStepName: 'Manager Approval',
    })
    await createRejectBranchStep({
      context,
      flowId,
      position: 3,
      linkedStepId: approvalStep.id,
    })

    const result = await getFlowService({
      user: context.currentUser,
      pipeId: flowId,
    })

    const returnedApprovalStep = result.steps.find(
      (s) => s.id === approvalStep.id,
    )
    expect(returnedApprovalStep?.appKey).toBe('formsg')
    expect(returnedApprovalStep?.key).toBe('mrfSubmission')
    const mrfParams = returnedApprovalStep?.parameters as {
      mrf?: { defaultStepName?: string; approvalField?: string }
    }
    expect(mrfParams?.mrf?.defaultStepName).toBe('Manager Approval')
    expect(mrfParams?.mrf?.approvalField).toBe('approval_field')

    const rejectStep = result.steps.find((s) => s.position === 3)
    expect(rejectStep?.config?.approval).toEqual({
      branch: 'reject',
      stepId: approvalStep.id,
    })
  })
})
