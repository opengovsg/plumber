/**
 * Business rule: AI builder edits to a pipe follow the existing collaborator
 * conflict check. A collaborator whose editor still holds the pre-edit
 * updatedAt must get the "edited by another user" error, not overwrite the
 * AI builder's change.
 */
import { randomUUID } from 'crypto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import Flow from '@/models/flow'
import FlowCollaborator from '@/models/flow-collaborators'
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

const STALE_UPDATED_AT = '2020-01-01T00:00:00.000Z'

describe('AI builder edits and collaborator conflict detection', () => {
  let owner: User
  let collaborator: User
  let flowId: string
  let actionStepId: string

  beforeEach(async () => {
    mocks.getAllLdFlags.mockResolvedValue({})
    mocks.getRestrictedAppKeys.mockReturnValue([])

    owner = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `pipe-edits-owner-${randomUUID()}@example.com`,
    })
    collaborator = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `pipe-edits-editor-${randomUUID()}@example.com`,
    })

    const flow = await createFlowWithStepsService({
      user: owner,
      name: 'Pipe Edits Critical',
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
      traceId: 'trace-pipe-edits',
    })
    flowId = flow.id
    actionStepId = flow.steps.find((step) => step.type === 'action')!.id

    await FlowCollaborator.query().insert({
      flowId,
      userId: collaborator.id,
      role: 'editor',
      updatedBy: owner.id,
    })

    // Raw update: the model hook would overwrite updated_at with now().
    await Flow.knex()('flows')
      .where('id', flowId)
      .update({ updated_at: STALE_UPDATED_AT, updated_by: collaborator.id })
  })

  async function expectCollaboratorSaveRejected(): Promise<void> {
    const flow = await Flow.query().findById(flowId).throwIfNotFound()
    expect(flow.updatedBy).toBe(owner.id)
    expect(() =>
      flow.assertNotUpdatedSince(
        String(new Date(STALE_UPDATED_AT).getTime()),
        collaborator.id,
      ),
    ).toThrow('This Pipe has been edited by another user')
  }

  it('rejects a stale collaborator save after update_step_parameters', async () => {
    await updateStepParametersService({
      user: owner,
      pipeId: flowId,
      stepId: actionStepId,
      parameters: { subject: 'Edited by AI builder' },
    })

    await expectCollaboratorSaveRejected()
  })
})
