import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it } from 'vitest'

import Flow from '../flow'
import FlowFolder from '../flow-folder'
import FlowFolderItem from '../flow-folder-item'
import User from '../user'

describe('flow folder item model', () => {
  let userId: string
  let flowId: string
  let folderAId: string
  let folderBId: string

  beforeEach(async () => {
    userId = randomUUID()
    await User.query().insert({ id: userId, email: 'owner@example.com' })

    const flow = await Flow.query().insert({
      id: randomUUID(),
      name: 'test flow',
      userId,
    })
    flowId = flow.id

    const folderA = await FlowFolder.query().insert({
      userId,
      name: 'Folder A',
      color: 'teal',
    })
    folderAId = folderA.id

    const folderB = await FlowFolder.query().insert({
      userId,
      name: 'Folder B',
      color: 'amber',
    })
    folderBId = folderB.id
  })

  it('files a previously-unfiled flow', async () => {
    await FlowFolderItem.moveFlowToFolder({
      userId,
      flowId,
      folderId: folderAId,
    })

    const item = await FlowFolderItem.query().findOne({
      user_id: userId,
      flow_id: flowId,
    })
    expect(item.folderId).toEqual(folderAId)
  })

  it('moves a flow between folders (upsert, not a second row)', async () => {
    await FlowFolderItem.moveFlowToFolder({
      userId,
      flowId,
      folderId: folderAId,
    })
    await FlowFolderItem.moveFlowToFolder({
      userId,
      flowId,
      folderId: folderBId,
    })

    const items = await FlowFolderItem.query().where({
      user_id: userId,
      flow_id: flowId,
    })
    expect(items).toHaveLength(1)
    expect(items[0].folderId).toEqual(folderBId)
  })

  it('unfiles a flow when folderId is null', async () => {
    await FlowFolderItem.moveFlowToFolder({
      userId,
      flowId,
      folderId: folderAId,
    })
    await FlowFolderItem.moveFlowToFolder({
      userId,
      flowId,
      folderId: null,
    })

    const item = await FlowFolderItem.query().findOne({
      user_id: userId,
      flow_id: flowId,
    })
    expect(item).toBeUndefined()
  })

  it('is a no-op when unfiling a flow that was never filed', async () => {
    await FlowFolderItem.moveFlowToFolder({
      userId,
      flowId,
      folderId: null,
    })

    const item = await FlowFolderItem.query().findOne({
      user_id: userId,
      flow_id: flowId,
    })
    expect(item).toBeUndefined()
  })

  it('re-activates a soft-deleted row instead of inserting a duplicate', async () => {
    await FlowFolderItem.moveFlowToFolder({
      userId,
      flowId,
      folderId: folderAId,
    })
    await FlowFolderItem.moveFlowToFolder({
      userId,
      flowId,
      folderId: null,
    })
    await FlowFolderItem.moveFlowToFolder({
      userId,
      flowId,
      folderId: folderBId,
    })

    const itemsIncludingDeleted = await FlowFolderItem.query()
      .where({ user_id: userId, flow_id: flowId })
      .withSoftDeleted()
    // Exactly one physical row throughout - proves re-filing reactivates the
    // existing (user_id, flow_id) row rather than inserting a new one, which
    // the composite primary key would reject anyway.
    expect(itemsIncludingDeleted).toHaveLength(1)
    expect(itemsIncludingDeleted[0].folderId).toEqual(folderBId)
    expect(itemsIncludingDeleted[0].deletedAt).toBeNull()
  })
})
