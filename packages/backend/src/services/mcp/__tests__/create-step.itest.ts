import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import User from '@/models/user'

import { createFlowWithStepsService } from '../create-flow-with-steps'
import { createStepService } from '../create-step'

const mocks = vi.hoisted(() => ({
  getAllLdFlags: vi.fn(),
  getRestrictedAppKeys: vi.fn(),
}))

vi.mock('@/helpers/launch-darkly', () => ({
  getAllLdFlags: mocks.getAllLdFlags,
  getRestrictedAppKeys: mocks.getRestrictedAppKeys,
}))

describe('createStepService', () => {
  beforeEach(() => {
    mocks.getAllLdFlags.mockResolvedValue({})
    mocks.getRestrictedAppKeys.mockReturnValue([])
  })

  it('appends a new action step at the end of the pipe', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `create-step-append-${randomUUID()}@example.com`,
    })

    const flow = await createFlowWithStepsService({
      user,
      name: 'Append Step Pipe',
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
      traceId: 'trace-create-1',
    })

    const step = await createStepService({
      user,
      pipeId: flow.id,
      appKey: 'slack',
      key: 'sendMessageToChannel',
    })

    expect(step.appKey).toBe('slack')
    expect(step.key).toBe('sendMessageToChannel')
    expect(step.type).toBe('action')
    expect(step.position).toBe(3)
    expect(step.parameters).toEqual({})
  })

  it('inserts a step after a given previousStepId and shifts later steps', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `create-step-insert-${randomUUID()}@example.com`,
    })

    const flow = await createFlowWithStepsService({
      user,
      name: 'Insert Step Pipe',
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
      traceId: 'trace-create-2',
    })

    const loadedFlow = await flow.$fetchGraph('steps')
    const triggerStep = loadedFlow.steps.find((s) => s.type === 'trigger')

    const newStep = await createStepService({
      user,
      pipeId: flow.id,
      appKey: 'postman',
      key: 'sendTransactionalEmail',
      previousStepId: triggerStep.id,
    })

    expect(newStep.position).toBe(2)

    // The old position-2 step should have shifted to position 3
    const loadedFlow2 = await flow.$fetchGraph('steps')
    const positions = loadedFlow2.steps
      .map((s) => s.position)
      .sort((a, b) => a - b)
    expect(positions).toEqual([1, 2, 3, 4])
  })

  it('throws if the trigger or action does not exist', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `create-step-notfound-${randomUUID()}@example.com`,
    })

    const flow = await createFlowWithStepsService({
      user,
      name: 'NotFound Pipe',
      steps: [
        {
          appKey: 'formsg',
          key: 'newSubmission',
          type: 'trigger',
          position: 1,
        },
      ],
      traceId: 'trace-create-3',
    })

    await expect(
      createStepService({
        user,
        pipeId: flow.id,
        appKey: 'slack',
        key: 'nonExistentAction',
      }),
    ).rejects.toThrow('No such trigger or action')
  })

  it('throws if the pipe does not belong to the requesting user', async () => {
    const owner = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `owner-create-step-${randomUUID()}@example.com`,
    })
    const intruder = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `intruder-create-step-${randomUUID()}@example.com`,
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
      traceId: 'trace-create-4',
    })

    await expect(
      createStepService({
        user: intruder,
        pipeId: flow.id,
        appKey: 'slack',
        key: 'sendMessageToChannel',
      }),
    ).rejects.toThrow('Pipe not found')
  })
})
