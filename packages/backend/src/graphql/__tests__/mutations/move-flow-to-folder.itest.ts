import { randomUUID } from 'crypto'
import { NotFoundError } from 'objection'
import { beforeEach, describe, expect, it } from 'vitest'

import moveFlowToFolder from '@/graphql/mutations/move-flow-to-folder'
import Flow from '@/models/flow'
import FlowCollaborator from '@/models/flow-collaborators'
import FlowFolder from '@/models/flow-folder'
import FlowFolderItem from '@/models/flow-folder-item'
import User from '@/models/user'
import Context from '@/types/express/context'

import { generateMockContext } from './tiles/table.mock'

describe('moveFlowToFolder', () => {
  let context: Context
  let owner: User
  let folder: FlowFolder
  let flow: Flow

  beforeEach(async () => {
    context = await generateMockContext()
    owner = context.currentUser

    folder = await FlowFolder.query().insert({
      userId: owner.id,
      name: 'Folder',
      color: 'teal',
    })
    flow = await owner.$relatedQuery('flows').insert({ name: 'test flow' })
  })

  it('files the pipe into the given folder', async () => {
    const result = await moveFlowToFolder(
      null,
      { input: { flowId: flow.id, folderId: folder.id } },
      context,
    )
    expect(result.id).toEqual(flow.id)

    const item = await FlowFolderItem.query().findOne({
      user_id: owner.id,
      flow_id: flow.id,
    })
    expect(item.folderId).toEqual(folder.id)
  })

  it('unfiles the pipe when folderId is null', async () => {
    await FlowFolderItem.moveFlowToFolder({
      userId: owner.id,
      flowId: flow.id,
      folderId: folder.id,
    })

    await moveFlowToFolder(
      null,
      { input: { flowId: flow.id, folderId: null } },
      context,
    )

    const item = await FlowFolderItem.query().findOne({
      user_id: owner.id,
      flow_id: flow.id,
    })
    expect(item).toBeUndefined()
  })

  it('lets a viewer-only collaborator file a shared pipe into their own folder', async () => {
    const viewer = await User.query().insert({
      id: randomUUID(),
      email: 'viewer@plumber.gov.sg',
    })
    await FlowCollaborator.query().insert({
      flowId: flow.id,
      userId: viewer.id,
      role: 'viewer',
      updatedBy: owner.id,
    })
    const viewerFolder = await FlowFolder.query().insert({
      userId: viewer.id,
      name: "Viewer's Folder",
      color: 'blue',
    })

    const viewerContext = { ...context, currentUser: viewer }
    await moveFlowToFolder(
      null,
      { input: { flowId: flow.id, folderId: viewerFolder.id } },
      viewerContext,
    )

    // Filed for the viewer only - the owner's own view is untouched.
    const viewerItem = await FlowFolderItem.query().findOne({
      user_id: viewer.id,
      flow_id: flow.id,
    })
    expect(viewerItem.folderId).toEqual(viewerFolder.id)

    const ownerItem = await FlowFolderItem.query().findOne({
      user_id: owner.id,
      flow_id: flow.id,
    })
    expect(ownerItem).toBeUndefined()
  })

  it('rejects filing a pipe the user cannot access', async () => {
    const stranger = await User.query().insert({
      id: randomUUID(),
      email: 'stranger@plumber.gov.sg',
    })
    const strangerFolder = await FlowFolder.query().insert({
      userId: stranger.id,
      name: 'Stranger Folder',
      color: 'red',
    })
    const strangerContext = { ...context, currentUser: stranger }

    await expect(
      moveFlowToFolder(
        null,
        { input: { flowId: flow.id, folderId: strangerFolder.id } },
        strangerContext,
      ),
    ).rejects.toThrow(NotFoundError)
  })

  it("rejects filing into another user's folder, even for an accessible pipe", async () => {
    const stranger = await User.query().insert({
      id: randomUUID(),
      email: 'stranger2@plumber.gov.sg',
    })
    const strangerFolder = await FlowFolder.query().insert({
      userId: stranger.id,
      name: 'Stranger Folder',
      color: 'red',
    })

    await expect(
      moveFlowToFolder(
        null,
        { input: { flowId: flow.id, folderId: strangerFolder.id } },
        context,
      ),
    ).rejects.toThrow(NotFoundError)

    const item = await FlowFolderItem.query().findOne({
      user_id: owner.id,
      flow_id: flow.id,
    })
    expect(item).toBeUndefined()
  })
})
