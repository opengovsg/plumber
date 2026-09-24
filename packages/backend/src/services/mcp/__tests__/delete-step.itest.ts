import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import Flow from '@/models/flow'
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

  it('appends a deletedSteps record when a traceId is provided', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `delete-step-stamp-${randomUUID()}@example.com`,
    })

    const flow = await createFlowWithStepsService({
      user,
      name: 'Stamp Delete Pipe',
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
      traceId: 'trace-create',
    })

    const loadedFlow = await flow.$fetchGraph('steps')
    const postmanStep = loadedFlow.steps.find((s) => s.appKey === 'postman')
    const slackStep = loadedFlow.steps.find((s) => s.appKey === 'slack')

    await deleteStepService({
      user,
      pipeId: flow.id,
      stepId: postmanStep.id,
      traceId: 'trace-delete-a',
    })

    await deleteStepService({
      user,
      pipeId: flow.id,
      stepId: slackStep.id,
      traceId: 'trace-delete-b',
    })

    const storedFlow = await Flow.query().findById(flow.id)

    expect(storedFlow?.config?.aiBuilderConfig?.deletedSteps).toEqual([
      {
        stepId: postmanStep.id,
        appKey: 'postman',
        key: 'sendTransactionalEmail',
        position: 2,
        traceId: 'trace-delete-a',
        createdByTool: 'create_pipe',
      },
      {
        stepId: slackStep.id,
        appKey: 'slack',
        key: 'sendMessageToChannel',
        position: 2,
        traceId: 'trace-delete-b',
        createdByTool: 'create_pipe',
      },
    ])
    expect(storedFlow?.config?.aiBuilderConfig?.traceId).toBe('trace-create')
    expect(storedFlow?.config?.aiBuilderConfig?.suggested).toHaveLength(3)
  })

  it('does not log deletedSteps without a traceId', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `delete-step-nolog-${randomUUID()}@example.com`,
    })

    const flow = await createFlowWithStepsService({
      user,
      name: 'No Log Delete Pipe',
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
      traceId: 'trace-create',
    })

    const loadedFlow = await flow.$fetchGraph('steps')
    const actionStep = loadedFlow.steps.find((s) => s.type === 'action')

    await deleteStepService({
      user,
      pipeId: flow.id,
      stepId: actionStep.id,
    })

    const storedFlow = await Flow.query().findById(flow.id)

    expect(storedFlow?.config?.aiBuilderConfig?.deletedSteps).toBeUndefined()
  })

  it('does not stamp the empty trigger inserted after an AI trigger delete', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `delete-step-empty-trigger-${randomUUID()}@example.com`,
    })

    const flow = await createFlowWithStepsService({
      user,
      name: 'Trigger Stamp Pipe',
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
      traceId: 'trace-create',
    })

    const loadedFlow = await flow.$fetchGraph('steps')
    const triggerStep = loadedFlow.steps.find((s) => s.type === 'trigger')

    const result = await deleteStepService({
      user,
      pipeId: flow.id,
      stepId: triggerStep.id,
      traceId: 'trace-delete-trigger',
    })

    const newTrigger = result.steps.find((s) => s.type === 'trigger')
    expect(newTrigger.config).toEqual({})

    const storedFlow = await Flow.query().findById(flow.id)
    expect(storedFlow?.config?.aiBuilderConfig?.deletedSteps).toEqual([
      {
        stepId: triggerStep.id,
        appKey: 'formsg',
        key: 'newSubmission',
        position: 1,
        traceId: 'trace-delete-trigger',
        createdByTool: 'create_pipe',
      },
    ])
  })
})
