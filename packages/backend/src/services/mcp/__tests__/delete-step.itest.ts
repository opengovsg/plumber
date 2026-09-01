import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import User from '@/models/user'

import { createFlowWithStepsService } from '../create-flow-with-steps'
import { deleteStepService } from '../delete-step'

const mocks = vi.hoisted(() => ({
  getAllLdFlags: vi.fn(),
  getRestrictedAppKeys: vi.fn(),
}))

vi.mock('@/helpers/launch-darkly', () => ({
  getAllLdFlags: mocks.getAllLdFlags,
  getRestrictedAppKeys: mocks.getRestrictedAppKeys,
}))

describe('deleteStepService', () => {
  beforeEach(() => {
    mocks.getAllLdFlags.mockResolvedValue({})
    mocks.getRestrictedAppKeys.mockReturnValue([])
  })

  it('deletes an action step and repositions remaining steps', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `delete-step-reposition-${randomUUID()}@example.com`,
    })

    const flow = await createFlowWithStepsService({
      user,
      name: 'Reposition Pipe',
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
        {
          appKey: 'slack',
          key: 'sendMessageToChannel',
          type: 'action',
          position: 3,
        },
      ],
      traceId: 'trace-delete-1',
    })

    const loadedFlow = await flow.$fetchGraph('steps')
    const actionStep = loadedFlow.steps.find(
      (s) => s.type === 'action' && s.appKey === 'postman',
    )
    expect(actionStep).toBeDefined()

    const result = await deleteStepService({
      user,
      pipeId: flow.id,
      stepId: actionStep.id,
    })

    expect(result.steps).toHaveLength(2)
    const positions = result.steps.map((s) => s.position).sort((a, b) => a - b)
    expect(positions).toEqual([1, 2])
  })

  it('deletes a trigger and replaces it with an empty trigger', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `delete-step-trigger-${randomUUID()}@example.com`,
    })

    const flow = await createFlowWithStepsService({
      user,
      name: 'Trigger Delete Pipe',
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
      traceId: 'trace-delete-2',
    })

    const loadedFlow = await flow.$fetchGraph('steps')
    const triggerStep = loadedFlow.steps.find((s) => s.type === 'trigger')
    expect(triggerStep).toBeDefined()

    const result = await deleteStepService({
      user,
      pipeId: flow.id,
      stepId: triggerStep.id,
    })

    expect(result.steps).toHaveLength(2)
    const newTrigger = result.steps.find((s) => s.type === 'trigger')
    expect(newTrigger).toBeDefined()
    expect(newTrigger.appKey).toBeNull()
    expect(newTrigger.key).toBeNull()
    expect(newTrigger.id).not.toBe(triggerStep.id)
  })

  it('throws if the step does not belong to the requesting user', async () => {
    const owner = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `owner-delete-step-${randomUUID()}@example.com`,
    })
    const intruder = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `intruder-delete-step-${randomUUID()}@example.com`,
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
      traceId: 'trace-delete-3',
    })

    const loadedFlow = await flow.$fetchGraph('steps')
    const actionStep = loadedFlow.steps.find((s) => s.type === 'action')

    await expect(
      deleteStepService({
        user: intruder,
        pipeId: flow.id,
        stepId: actionStep.id,
      }),
    ).rejects.toThrow('Step not found')
  })

  it('throws if the stepId does not belong to the given pipeId', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `mismatch-delete-step-${randomUUID()}@example.com`,
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
        {
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          type: 'action',
          position: 2,
        },
      ],
      traceId: 'trace-delete-4',
    })

    const loadedFlow = await flow.$fetchGraph('steps')
    const actionStep = loadedFlow.steps.find((s) => s.type === 'action')

    await expect(
      deleteStepService({
        user,
        pipeId: randomUUID(), // wrong pipe ID
        stepId: actionStep.id,
      }),
    ).rejects.toThrow('Step not found')
  })
})
