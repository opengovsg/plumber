import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it } from 'vitest'

import { BadUserInputError } from '@/errors/graphql-errors'
import upsertFlowCollaborator from '@/graphql/mutations/upsert-flow-collaborator'
import Flow from '@/models/flow'
import FlowCollaborator from '@/models/flow-collaborators'
import User from '@/models/user'
import Context from '@/types/express/context'

import { generateMockContext } from './tiles/table.mock'

describe('upsert flow collaborator', () => {
  let context: Context
  let dummyFlow: Flow
  let editor: User
  let viewer: User

  beforeEach(async () => {
    context = await generateMockContext()

    dummyFlow = await Flow.query().insert({
      id: randomUUID(),
      name: 'test flow',
      userId: context.currentUser.id,
    })

    editor = await User.query().insert({
      id: randomUUID(),
      email: 'editor@plumber.gov.sg',
    })

    viewer = await User.query().insert({
      id: randomUUID(),
      email: 'viewer@plumber.gov.sg',
    })
  })

  it('owner should be able to add new editor', async () => {
    await upsertFlowCollaborator(
      null,
      { input: { flowId: dummyFlow.id, email: editor.email, role: 'editor' } },
      context,
    )
    const collaborators = await FlowCollaborator.query().where(
      'flow_id',
      dummyFlow.id,
    )
    expect(collaborators).toHaveLength(1)
    expect(collaborators[0].userId).toBe(editor.id)
    expect(collaborators[0].role).toBe('editor')
  })

  it('owner should be able to add new viewer', async () => {
    await upsertFlowCollaborator(
      null,
      { input: { flowId: dummyFlow.id, email: viewer.email, role: 'viewer' } },
      context,
    )
    const collaborators = await FlowCollaborator.query().where(
      'flow_id',
      dummyFlow.id,
    )
    expect(collaborators).toHaveLength(1)
    expect(collaborators[0].userId).toBe(viewer.id)
    expect(collaborators[0].role).toBe('viewer')
  })

  it('should be able to update roles', async () => {
    await upsertFlowCollaborator(
      null,
      { input: { flowId: dummyFlow.id, email: editor.email, role: 'viewer' } },
      context,
    )

    const collaborators = await FlowCollaborator.query().where(
      'flow_id',
      dummyFlow.id,
    )
    expect(collaborators).toHaveLength(1)
    expect(collaborators[0].userId).toBe(editor.id)
    expect(collaborators[0].role).toBe('viewer')
  })

  it('should not allow editing role of owner', async () => {
    await expect(
      upsertFlowCollaborator(
        null,
        {
          input: {
            flowId: dummyFlow.id,
            email: context.currentUser.email,
            role: 'editor',
          },
        },
        context,
      ),
    ).rejects.toThrow(BadUserInputError)
  })

  it('should not allow editing of own role', async () => {
    context.currentUser = editor
    await expect(
      upsertFlowCollaborator(
        null,
        {
          input: {
            flowId: dummyFlow.id,
            email: context.currentUser.email,
            role: 'viewer',
          },
        },
        context,
      ),
    ).rejects.toThrow(BadUserInputError)
  })

  it('viewer should not be able to modify collaborator', async () => {
    context.currentUser = viewer
    await expect(
      upsertFlowCollaborator(
        null,
        {
          input: {
            flowId: dummyFlow.id,
            email: 'new-user@plumber.gov.sg',
            role: 'editor',
          },
        },
        context,
      ),
    ).rejects.toThrowError(
      'You do not have sufficient permissions for this pipe',
    )
  })
})
