import { randomUUID } from 'crypto'
import { NotFoundError } from 'objection'
import { beforeEach, describe, expect, it } from 'vitest'

import deleteFlowFolder from '@/graphql/mutations/delete-flow-folder'
import Flow from '@/models/flow'
import FlowFolder from '@/models/flow-folder'
import FlowFolderItem from '@/models/flow-folder-item'
import User from '@/models/user'
import Context from '@/types/express/context'

import { generateMockContext } from './tiles/table.mock'

describe('deleteFlowFolder', () => {
  let context: Context
  let owner: User
  let folder: FlowFolder
  let flowA: Flow
  let flowB: Flow

  beforeEach(async () => {
    context = await generateMockContext()
    owner = context.currentUser

    folder = await FlowFolder.query().insert({
      userId: owner.id,
      name: 'To Delete',
      color: 'teal',
    })

    flowA = await owner.$relatedQuery('flows').insert({ name: 'flow a' })
    flowB = await owner.$relatedQuery('flows').insert({ name: 'flow b' })

    await FlowFolderItem.moveFlowToFolder({
      userId: owner.id,
      flowId: flowA.id,
      folderId: folder.id,
    })
    await FlowFolderItem.moveFlowToFolder({
      userId: owner.id,
      flowId: flowB.id,
      folderId: folder.id,
    })
  })

  it('never deletes the pipes filed into the folder', async () => {
    await deleteFlowFolder(null, { input: { id: folder.id } }, context)

    // The highest-severity assertion in this feature: the flows themselves
    // must still exist, fully intact, after deleting their folder.
    const survivingFlowA = await Flow.query().findById(flowA.id)
    const survivingFlowB = await Flow.query().findById(flowB.id)
    expect(survivingFlowA).toBeDefined()
    expect(survivingFlowA.deletedAt).toBeFalsy()
    expect(survivingFlowB).toBeDefined()
    expect(survivingFlowB.deletedAt).toBeFalsy()
  })

  it('unfiles every pipe that was in the folder', async () => {
    await deleteFlowFolder(null, { input: { id: folder.id } }, context)

    const remainingItems = await FlowFolderItem.query().where(
      'folder_id',
      folder.id,
    )
    expect(remainingItems).toHaveLength(0)
  })

  it('soft-deletes the folder', async () => {
    const result = await deleteFlowFolder(
      null,
      { input: { id: folder.id } },
      context,
    )
    expect(result).toBe(true)

    const activeFolder = await FlowFolder.query().findById(folder.id)
    expect(activeFolder).toBeUndefined()

    const softDeletedFolder = await FlowFolder.query()
      .findById(folder.id)
      .withSoftDeleted()
    expect(softDeletedFolder.deletedAt).toBeTruthy()
  })

  it("never deletes another user's folder", async () => {
    const stranger = await User.query().insert({
      id: randomUUID(),
      email: 'stranger@plumber.gov.sg',
    })
    const strangerFolder = await FlowFolder.query().insert({
      userId: stranger.id,
      name: 'Stranger Folder',
      color: 'slate',
    })

    await expect(
      deleteFlowFolder(null, { input: { id: strangerFolder.id } }, context),
    ).rejects.toThrow(NotFoundError)

    const unchanged = await FlowFolder.query().findById(strangerFolder.id)
    expect(unchanged).toBeDefined()
  })

  it("does not unfile another user's pipe filed by them into their own, differently-owned folder row", async () => {
    // Belt-and-braces: the folder lookup is scoped by user_id, so even if a
    // (hypothetical) foreign flow_folder_items row pointed at this folder id
    // for another user, deleting only ever touches this user's filing rows.
    const stranger = await User.query().insert({
      id: randomUUID(),
      email: 'stranger2@plumber.gov.sg',
    })
    const strangerFlow = await stranger
      .$relatedQuery('flows')
      .insert({ name: 'stranger flow' })
    const strangerFolder = await FlowFolder.query().insert({
      userId: stranger.id,
      name: 'Stranger Own Folder',
      color: 'red',
    })
    await FlowFolderItem.moveFlowToFolder({
      userId: stranger.id,
      flowId: strangerFlow.id,
      folderId: strangerFolder.id,
    })

    await deleteFlowFolder(null, { input: { id: folder.id } }, context)

    const strangerItem = await FlowFolderItem.query().findOne({
      user_id: stranger.id,
      flow_id: strangerFlow.id,
    })
    expect(strangerItem).toBeDefined()
    expect(strangerItem.folderId).toEqual(strangerFolder.id)
  })
})
