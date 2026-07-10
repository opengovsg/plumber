import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import User from '@/models/user'

import { createFlowWithStepsService } from '../create-flow-with-steps'
import { updateStepParametersService } from '../update-step-parameters'

const mocks = vi.hoisted(() => ({
  getAllLdFlags: vi.fn(),
  getRestrictedAppKeys: vi.fn(),
}))

vi.mock('@/helpers/launch-darkly', () => ({
  getAllLdFlags: mocks.getAllLdFlags,
  getRestrictedAppKeys: mocks.getRestrictedAppKeys,
}))

describe('updateStepParametersService', () => {
  beforeEach(() => {
    // Return no LD flags so no apps are restricted
    mocks.getAllLdFlags.mockResolvedValue({})
    mocks.getRestrictedAppKeys.mockReturnValue([])
  })

  it('saves only field keys defined in the action schema, silently dropping unknown keys', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `update-params-filter-${randomUUID()}@example.com`,
    })

    const flow = await createFlowWithStepsService({
      user,
      name: 'Filter Test Pipe',
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
      traceId: 'trace-filter-1',
    })

    const actionStep = flow.steps.find((s) => s.type === 'action')
    expect(actionStep).toBeDefined()

    const result = await updateStepParametersService({
      user,
      pipeId: flow.id,
      stepId: actionStep.id,
      parameters: {
        subject: 'Hello world', // valid — in postman sendTransactionalEmail schema
        destinationEmail: ['a@b.com'], // valid — in postman sendTransactionalEmail schema
        unknownHallucinatedField: 'drop', // invalid — not in schema, must be dropped
      },
    })

    expect(result.parameters).toMatchObject({
      subject: 'Hello world',
      destinationEmail: ['a@b.com'],
    })
    expect(result.parameters).not.toHaveProperty('unknownHallucinatedField')
  })

  it('sets status to incomplete after parameter update', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `update-params-status-${randomUUID()}@example.com`,
    })

    const flow = await createFlowWithStepsService({
      user,
      name: 'Status Test Pipe',
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
      traceId: 'trace-status-2',
    })

    const actionStep = flow.steps.find((s) => s.type === 'action')
    expect(actionStep).toBeDefined()

    const result = await updateStepParametersService({
      user,
      pipeId: flow.id,
      stepId: actionStep.id,
      parameters: { subject: 'Test' },
    })

    expect(result.status).toBe('incomplete')
  })

  it('throws if the step does not belong to the requesting user', async () => {
    const owner = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `owner-${randomUUID()}@example.com`,
    })
    const intruder = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `intruder-${randomUUID()}@example.com`,
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
        {
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          type: 'action',
          position: 2,
        },
      ],
      traceId: 'trace-access-3',
    })

    const actionStep = flow.steps.find((s) => s.type === 'action')
    expect(actionStep).toBeDefined()

    await expect(
      updateStepParametersService({
        user: intruder,
        pipeId: flow.id,
        stepId: actionStep.id,
        parameters: { subject: 'Hack' },
      }),
    ).rejects.toThrow('Step not found')
  })

  it('throws if the stepId does not belong to the given pipeId', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `mismatch-${randomUUID()}@example.com`,
    })

    const flow = await createFlowWithStepsService({
      user,
      name: 'Mismatch Pipe',
      steps: [
        {
          appKey: 'formsg',
          key: 'newSubmission',
          type: 'trigger',
          position: 1,
        },
      ],
      traceId: 'trace-mismatch-4',
    })

    const triggerStep = flow.steps[0]
    expect(triggerStep).toBeDefined()

    await expect(
      updateStepParametersService({
        user,
        pipeId: randomUUID(), // wrong pipe ID
        stepId: triggerStep.id,
        parameters: {},
      }),
    ).rejects.toThrow('Step not found')
  })

  it('merges parameters across repeated calls instead of overwriting', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `update-params-merge-${randomUUID()}@example.com`,
    })

    const flow = await createFlowWithStepsService({
      user,
      name: 'Merge Test Pipe',
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
      traceId: 'trace-merge-1',
    })

    const actionStep = flow.steps.find((s) => s.type === 'action')
    expect(actionStep).toBeDefined()

    // First call: set subject
    await updateStepParametersService({
      user,
      pipeId: flow.id,
      stepId: actionStep.id,
      parameters: { subject: 'Hello world' },
    })

    // Second call: set destinationEmail — must not wipe out subject
    const result = await updateStepParametersService({
      user,
      pipeId: flow.id,
      stepId: actionStep.id,
      parameters: { destinationEmail: ['a@b.com'] },
    })

    expect(result.parameters).toMatchObject({
      subject: 'Hello world',
      destinationEmail: ['a@b.com'],
    })
  })
})
