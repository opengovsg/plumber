import { randomUUID } from 'crypto'
import { NotFoundError } from 'objection'
import { beforeEach, describe, expect, it } from 'vitest'

import { BadUserInputError } from '@/errors/graphql-errors'
import deleteFlowCollaborator from '@/graphql/mutations/delete-flow-collaborator'
import Flow from '@/models/flow'
import FlowCollaborator from '@/models/flow-collaborators'
import User from '@/models/user'
import Context from '@/types/express/context'

import { generateMockContext } from './tiles/table.mock'

describe('delete flow collaborators', () => {
  let context: Context
  let dummyFlow: Flow
  let owner: User
  let editor: User
  let viewer: User
  let nonCollaborator: User
  const editorUserId = randomUUID()
  const viewerUserId = randomUUID()
  const nonCollaboratorUserId = randomUUID()

  beforeEach(async () => {
    context = await generateMockContext()

    owner = context.currentUser

    editor = await User.query().insert({
      id: editorUserId,
      email: 'editor@plumber.gov.sg',
    })

    viewer = await User.query().insert({
      id: viewerUserId,
      email: 'viewer@plumber.gov.sg',
    })

    nonCollaborator = await User.query().insert({
      id: nonCollaboratorUserId,
      email: 'non-collaborator@plumber.gov.sg',
    })

    const mockFlow = await Flow.query().insert({
      id: randomUUID(),
      name: 'test flow',
      userId: owner.id,
    })

    await FlowCollaborator.query().insert([
      {
        flowId: mockFlow.id,
        userId: editorUserId,
        role: 'editor',
        updatedBy: context.currentUser.id,
      },
      {
        flowId: mockFlow.id,
        userId: viewerUserId,
        role: 'viewer',
        updatedBy: context.currentUser.id,
      },
    ])

    dummyFlow = mockFlow
  })

  it('should be able to delete collaborators', async () => {
    await deleteFlowCollaborator(
      null,
      { input: { flowId: dummyFlow.id, email: viewer.email } },
      context,
    )
    const flowCollaborators = await FlowCollaborator.query()
      .where('flow_id', dummyFlow.id)
      .where('deleted_at', null)

    expect(flowCollaborators).toHaveLength(1)
    const removedViewer = flowCollaborators.find(
      (col) => col.email === viewer.email,
    )
    expect(removedViewer).toBeUndefined()
  })

  it('should throw an error if collaborator is not found', async () => {
    await expect(
      deleteFlowCollaborator(
        null,
        { input: { flowId: dummyFlow.id, email: 'viewer332@plumber.gov.sg' } },
        context,
      ),
    ).rejects.toThrow(NotFoundError)
  })

  it('should allow an editor to leave the pipe', async () => {
    context.currentUser = editor
    await deleteFlowCollaborator(
      null,
      { input: { flowId: dummyFlow.id, email: editor.email } },
      context,
    )

    const editorRow = await FlowCollaborator.query()
      .findOne({
        flow_id: dummyFlow.id,
        user_id: editor.id,
      })
      .where('deleted_at', null)

    expect(editorRow).toBeUndefined()
  })

  it('should allow a viewer to leave the pipe', async () => {
    context.currentUser = viewer
    await deleteFlowCollaborator(
      null,
      { input: { flowId: dummyFlow.id, email: viewer.email } },
      context,
    )

    const viewerRow = await FlowCollaborator.query()
      .findOne({
        flow_id: dummyFlow.id,
        user_id: viewer.id,
      })
      .where('deleted_at', null)

    expect(viewerRow).toBeUndefined()
  })

  it('should throw an error when the owner tries to leave', async () => {
    await expect(
      deleteFlowCollaborator(
        null,
        { input: { flowId: dummyFlow.id, email: owner.email } },
        context,
      ),
    ).rejects.toThrow(BadUserInputError)
  })

  it('should not distinguish nonexistent and inaccessible flows when leaving', async () => {
    context.currentUser = nonCollaborator
    const otherOwnerFlow = await Flow.query().insert({
      id: randomUUID(),
      name: 'other owner flow',
      userId: owner.id,
    })

    await expect(
      deleteFlowCollaborator(
        null,
        { input: { flowId: randomUUID(), email: nonCollaborator.email } },
        context,
      ),
    ).rejects.toThrow(NotFoundError)

    await expect(
      deleteFlowCollaborator(
        null,
        { input: { flowId: otherOwnerFlow.id, email: nonCollaborator.email } },
        context,
      ),
    ).rejects.toThrow(NotFoundError)
  })

  it('should throw an error if trying to delete owner', async () => {
    context.currentUser = editor
    await expect(
      deleteFlowCollaborator(
        null,
        { input: { flowId: dummyFlow.id, email: owner.email } },
        context,
      ),
    ).rejects.toThrowError('No such collaborator found') // owner does not exist in flow_collaborators table
  })

  it('should throw an error if user is not a collaborator', async () => {
    await expect(
      deleteFlowCollaborator(
        null,
        {
          input: {
            flowId: dummyFlow.id,
            email: nonCollaborator.email,
          },
        },
        context,
      ),
    ).rejects.toThrowError('No such collaborator found')
  })

  it('should throw an error if user does not have permission to delete collaborator', async () => {
    context.currentUser = viewer
    await expect(
      deleteFlowCollaborator(
        null,
        { input: { flowId: dummyFlow.id, email: editor.email } },
        context,
      ),
    ).rejects.toThrowError('You do not have sufficient permissions')
  })
})
