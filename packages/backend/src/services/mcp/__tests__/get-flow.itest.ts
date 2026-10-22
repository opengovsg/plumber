import { randomUUID } from 'crypto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createMrfActionStep,
  createMrfTriggerStep,
  createRejectBranchStep,
  generateMockContext,
  generateMockFlow,
} from '@/apps/formsg/__tests__/mrf.mock'
import Step from '@/models/step'
import User from '@/models/user'

import { createFlowWithStepsService } from '../create-flow-with-steps'
import { getFlowService, REDACTED_VALUE } from '../get-flow'

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

  it('surfaces MRF branch metadata without internal step config', async () => {
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

    await approvalStep.$query().patch({
      config: {
        stepName: 'Manager Approval',
        adminOverride: { internalSetting: 'not-for-chat' },
        aiBuilderConfig: [{ traceId: 'internal-trace', tool: 'create_step' }],
      },
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
    expect(returnedApprovalStep?.config).toEqual({
      stepName: 'Manager Approval',
    })
    expect(JSON.stringify(result)).not.toContain('not-for-chat')
    expect(JSON.stringify(result)).not.toContain('internal-trace')
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

  it('redacts static credential headers from an existing Custom API step', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `get-flow-redact-${randomUUID()}@example.com`,
    })
    const flow = await createFlowWithStepsService({
      user,
      name: 'Custom API Pipe',
      steps: [
        {
          appKey: 'formsg',
          key: 'newSubmission',
          type: 'trigger',
          position: 1,
        },
        {
          appKey: 'custom-api',
          key: 'httpRequest',
          type: 'action',
          position: 2,
        },
      ],
      traceId: 'trace-get-flow-redact',
    })
    const stepVariable =
      'Bearer {{step.6e2bb8a2-2c4c-4b8e-9f0a-3f5d2c1b7a90.token}}'
    const actionStep = await Step.query()
      .findOne({ flow_id: flow.id, position: 2 })
      .throwIfNotFound()
    await actionStep.$query().patch({
      parameters: {
        method: 'GET',
        url: 'https://example.com/api',
        customHeaders: [
          { key: 'Authorization', value: 'Bearer sk-live-secret' },
          { key: 'X-API-Key', value: 'abc123-secret' },
          { key: 'Authorization', value: stepVariable },
          { key: 'Accept', value: 'application/json' },
        ],
      },
    })

    const result = await getFlowService({ user, pipeId: flow.id })

    expect(JSON.stringify(result)).not.toContain('sk-live-secret')
    expect(JSON.stringify(result)).not.toContain('abc123-secret')
    const returnedStep = result.steps.find((s) => s.id === actionStep.id)
    expect(returnedStep?.parameters).toEqual({
      method: 'GET',
      url: 'https://example.com/api',
      customHeaders: [
        { key: 'Authorization', value: REDACTED_VALUE },
        { key: 'X-API-Key', value: REDACTED_VALUE },
        { key: 'Authorization', value: stepVariable },
        { key: 'Accept', value: 'application/json' },
      ],
    })
  })
})
