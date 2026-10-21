import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import Flow from '@/models/flow'
import Step from '@/models/step'
import User from '@/models/user'

import { createFlowWithStepsService } from '../create-flow-with-steps'
import { createStepService } from '../create-step'
import { deleteStepService } from '../delete-step'

const mocks = vi.hoisted(() => ({
  getAllLdFlags: vi.fn(),
  getRestrictedAppKeys: vi.fn(),
}))

vi.mock('@/helpers/launch-darkly', () => ({
  getAllLdFlags: mocks.getAllLdFlags,
  getRestrictedAppKeys: mocks.getRestrictedAppKeys,
  // The If block flag stays on. Legacy pipes are pinned when a step is deleted.
  getLdFlagValue: vi.fn().mockResolvedValue(true),
}))

describe('deleteStepService', () => {
  beforeEach(() => {
    mocks.getAllLdFlags.mockResolvedValue({})
    mocks.getRestrictedAppKeys.mockReturnValue([])
  })

  it('rejects deletion from a published pipe', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `delete-step-published-${randomUUID()}@example.com`,
    })
    const flow = await createFlowWithStepsService({
      user,
      name: 'Published Pipe',
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
      traceId: 'trace-delete-published',
    })
    await Flow.knex().table('flows').where('id', flow.id).update({
      active: true,
    })
    const loadedFlow = await flow.$fetchGraph('steps')

    await expect(
      deleteStepService({
        user,
        pipeId: flow.id,
        stepId: loadedFlow.steps[1].id,
      }),
    ).rejects.toThrow(
      'This pipe is published. Ask the user to unpublish it before making changes.',
    )
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
    expect(newTrigger.config).toEqual({})
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

  it('nests deleted on a soft-deleted AI-created step', async () => {
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
      ],
      traceId: 'trace-create',
    })

    const loadedFlow = await flow.$fetchGraph('steps')
    const actionStep = loadedFlow.steps.find((s) => s.type === 'action')

    await deleteStepService({
      user,
      pipeId: flow.id,
      stepId: actionStep.id,
      traceId: 'trace-delete',
    })

    const visible = await Step.query().findById(actionStep.id)
    expect(visible).toBeUndefined()

    const stored = await Step.query().withSoftDeleted().findById(actionStep.id)
    expect(stored?.deletedAt).toBeTruthy()
    expect(stored?.config).toEqual({
      aiBuilderConfig: [
        {
          traceId: 'trace-create',
          tool: 'create_pipe',
        },
        {
          traceId: 'trace-delete',
          tool: 'delete_step',
        },
      ],
    })
  })

  it('stamps delete_step on a soft-deleted user-created step', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `delete-step-user-${randomUUID()}@example.com`,
    })

    const flow = await createFlowWithStepsService({
      user,
      name: 'User Step Pipe',
      steps: [
        {
          appKey: 'formsg',
          key: 'newSubmission',
          type: 'trigger',
          position: 1,
        },
      ],
      traceId: 'trace-create',
    })

    const loadedFlow = await flow.$fetchGraph('steps')
    const trigger = loadedFlow.steps[0]
    const userStep = await createStepService({
      user,
      pipeId: flow.id,
      appKey: 'slack',
      key: 'sendMessageToChannel',
      previousStepId: trigger.id,
    })

    await deleteStepService({
      user,
      pipeId: flow.id,
      stepId: userStep.id,
      traceId: 'trace-delete',
    })

    const stored = await Step.query().withSoftDeleted().findById(userStep.id)
    expect(stored?.deletedAt).toBeTruthy()
    expect(stored?.config).toEqual({
      aiBuilderConfig: [
        {
          traceId: 'trace-delete',
          tool: 'delete_step',
        },
      ],
    })
  })

  it('does not stamp deletion without a traceId', async () => {
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

    const stored = await Step.query().withSoftDeleted().findById(actionStep.id)
    expect(stored?.deletedAt).toBeTruthy()
    expect(stored?.config).toEqual({
      aiBuilderConfig: [
        {
          traceId: 'trace-create',
          tool: 'create_pipe',
        },
      ],
    })
  })

  it('stamps cascaded FormSG MRF and reject-branch deletes', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `delete-step-mrf-${randomUUID()}@example.com`,
    })

    const flow = await createFlowWithStepsService({
      user,
      name: 'MRF Cascade Pipe',
      steps: [
        {
          appKey: 'formsg',
          key: 'newSubmission',
          type: 'trigger',
          position: 1,
        },
      ],
      traceId: 'trace-create',
    })

    const loadedFlow = await flow.$fetchGraph('steps')
    const trigger = loadedFlow.steps[0]
    const mrfStep = await flow.$relatedQuery('steps').insertAndFetch({
      type: 'action',
      appKey: 'formsg',
      key: 'mrfSubmission',
      position: 2,
      parameters: {},
      config: {
        aiBuilderConfig: [{ traceId: 'trace-create', tool: 'create_pipe' }],
      },
    })
    const rejectStep = await flow.$relatedQuery('steps').insertAndFetch({
      type: 'action',
      appKey: 'postman',
      key: 'sendTransactionalEmail',
      position: 3,
      parameters: {},
      config: {
        approval: { branch: 'reject', stepId: mrfStep.id },
      },
    })

    await deleteStepService({
      user,
      pipeId: flow.id,
      stepId: trigger.id,
      traceId: 'trace-delete',
    })

    const storedTrigger = await Step.query()
      .withSoftDeleted()
      .findById(trigger.id)
    const storedMrf = await Step.query().withSoftDeleted().findById(mrfStep.id)
    const storedReject = await Step.query()
      .withSoftDeleted()
      .findById(rejectStep.id)

    expect(storedTrigger?.deletedAt).toBeTruthy()
    expect(storedMrf?.deletedAt).toBeTruthy()
    expect(storedReject?.deletedAt).toBeTruthy()
    expect(storedTrigger?.config.aiBuilderConfig).toEqual([
      { traceId: 'trace-create', tool: 'create_pipe' },
      { traceId: 'trace-delete', tool: 'delete_step' },
    ])
    expect(storedMrf?.config.aiBuilderConfig).toEqual([
      { traceId: 'trace-create', tool: 'create_pipe' },
      { traceId: 'trace-delete', tool: 'delete_step' },
    ])
    expect(storedReject?.config.aiBuilderConfig).toEqual([
      { traceId: 'trace-delete', tool: 'delete_step' },
    ])
    expect(storedReject?.config.approval).toEqual({
      branch: 'reject',
      stepId: mrfStep.id,
    })
  })

  describe('If blocks', () => {
    async function createBlockPipe(label: string) {
      const user = await User.query().insertAndFetch({
        id: randomUUID(),
        email: `delete-step-block-${label}-${randomUUID()}@example.com`,
      })
      // Pipe creation does not pin markers yet on this branch.
      const flow = await createFlowWithStepsService({
        user,
        name: 'Block Pipe',
        steps: [
          {
            appKey: 'formsg',
            key: 'newSubmission',
            type: 'trigger',
            position: 1,
          },
          {
            appKey: 'toolbox',
            key: 'ifThen',
            type: 'action',
            position: 2,
          },
          {
            appKey: 'slack',
            key: 'sendMessageToChannel',
            type: 'action',
            position: 3,
          },
          {
            appKey: 'postman-sms',
            key: 'sendSms',
            type: 'action',
            position: 4,
          },
          {
            appKey: 'postman',
            key: 'sendTransactionalEmail',
            type: 'action',
            position: 5,
          },
        ],
        traceId: `trace-delete-block-${label}`,
      })
      const [, ifThen, slack, sms, email] = flow.steps
      // If [ slack, sms ], with email outside the block.
      await Step.query()
        .findById(ifThen.id)
        .patch({
          config: { endStepId: sms.id },
        })
      return { user, flow, ifThen, slack, sms, email }
    }

    it('shrinks the block when its last inner step is deleted', async () => {
      const { user, flow, ifThen, slack, sms } = await createBlockPipe('shrink')

      const result = await deleteStepService({
        user,
        pipeId: flow.id,
        stepId: sms.id,
      })

      expect(result.steps.map((s) => s.key)).toEqual([
        'newSubmission',
        'ifThen',
        'sendMessageToChannel',
        'sendTransactionalEmail',
      ])
      const updatedIfThen = result.steps.find((s) => s.id === ifThen.id)
      expect(updatedIfThen.config.endStepId).toBe(slack.id)
    })

    it('deletes the whole block when the If step is deleted, and keeps the step after it', async () => {
      const { user, flow, ifThen } = await createBlockPipe('unwrap')

      const result = await deleteStepService({
        user,
        pipeId: flow.id,
        stepId: ifThen.id,
      })

      expect(result.steps.map((s) => s.key)).toEqual([
        'newSubmission',
        'sendTransactionalEmail',
      ])
      expect(result.steps.map((s) => s.position)).toEqual([1, 2])
    })

    it('stamps delete_step once on every soft-deleted block member', async () => {
      const { user, flow, ifThen, slack, sms, email } = await createBlockPipe(
        'stamp',
      )

      await deleteStepService({
        user,
        pipeId: flow.id,
        stepId: ifThen.id,
        traceId: 'trace-delete',
      })

      const storedIfThen = await Step.query()
        .withSoftDeleted()
        .findById(ifThen.id)
      expect(storedIfThen?.deletedAt).toBeTruthy()
      expect(storedIfThen?.config).toEqual({
        endStepId: sms.id,
        aiBuilderConfig: [{ traceId: 'trace-delete', tool: 'delete_step' }],
      })

      for (const member of [slack, sms]) {
        const stored = await Step.query().withSoftDeleted().findById(member.id)
        expect(stored?.deletedAt).toBeTruthy()
        expect(stored?.config.aiBuilderConfig).toEqual([
          { traceId: 'trace-delete-block-stamp', tool: 'create_pipe' },
          { traceId: 'trace-delete', tool: 'delete_step' },
        ])
      }

      const storedEmail = await Step.query().findById(email.id)
      expect(storedEmail?.config.aiBuilderConfig).toEqual([
        { traceId: 'trace-delete-block-stamp', tool: 'create_pipe' },
      ])
    })

    it('deletes a legacy If block through its derived extent', async () => {
      const { user, flow, ifThen } = await createBlockPipe('legacy-block')
      await Step.query().findById(ifThen.id).patch({ config: {} })

      const result = await deleteStepService({
        user,
        pipeId: flow.id,
        stepId: ifThen.id,
      })

      // With no marker the block runs through to the end of the pipe.
      expect(result.steps.map((s) => s.key)).toEqual(['newSubmission'])
    })

    it('pins a legacy If block and shrinks it when its last step is deleted', async () => {
      const { user, flow, ifThen, email, sms } = await createBlockPipe('legacy')
      await Step.query().findById(ifThen.id).patch({ config: {} })

      const result = await deleteStepService({
        user,
        pipeId: flow.id,
        stepId: email.id,
      })

      const updatedIfThen = result.steps.find((s) => s.id === ifThen.id)
      expect(updatedIfThen?.config.endStepId).toBe(sms.id)
    })

    it('deletes the derived extent when the If marker points at a missing step', async () => {
      const { user, flow, ifThen } = await createBlockPipe('dangling')
      await Step.query()
        .findById(ifThen.id)
        .patch({ config: { endStepId: 'missing-step' } })

      const result = await deleteStepService({
        user,
        pipeId: flow.id,
        stepId: ifThen.id,
      })

      expect(result.steps.map((s) => s.key)).toEqual(['newSubmission'])
    })
  })
})
