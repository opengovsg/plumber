import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it } from 'vitest'

import getFlowFolders from '@/graphql/queries/get-flow-folders'
import Flow from '@/models/flow'
import FlowFolder from '@/models/flow-folder'
import FlowFolderItem from '@/models/flow-folder-item'
import User from '@/models/user'
import Context from '@/types/express/context'

import { generateMockContext } from '../mutations/tiles/table.mock'

describe('getFlowFolders', () => {
  let context: Context
  let owner: User

  beforeEach(async () => {
    context = await generateMockContext()
    owner = context.currentUser
  })

  it('returns an empty list for a user with no folders', async () => {
    const result = await getFlowFolders({}, {}, context)
    expect(result).toEqual([])
  })

  it('returns folders ordered by name ascending, with flowCount', async () => {
    const folderZebra = await FlowFolder.query().insert({
      userId: owner.id,
      name: 'Zebra',
      color: 'red',
    })
    const folderApple = await FlowFolder.query().insert({
      userId: owner.id,
      name: 'Apple',
      color: 'blue',
    })

    const flow1 = await owner.$relatedQuery('flows').insert({ name: 'flow1' })
    const flow2 = await owner.$relatedQuery('flows').insert({ name: 'flow2' })

    await FlowFolderItem.moveFlowToFolder({
      userId: owner.id,
      flowId: flow1.id,
      folderId: folderApple.id,
    })
    await FlowFolderItem.moveFlowToFolder({
      userId: owner.id,
      flowId: flow2.id,
      folderId: folderApple.id,
    })

    const result = await getFlowFolders({}, {}, context)

    expect(result.map((f) => f.name)).toEqual(['Apple', 'Zebra'])
    expect(result.find((f) => f.id === folderApple.id).flowCount).toEqual(2)
    expect(result.find((f) => f.id === folderZebra.id).flowCount).toEqual(0)
  })

  it("never returns another user's folders", async () => {
    const stranger = await User.query().insert({
      id: randomUUID(),
      email: 'stranger@plumber.gov.sg',
    })
    await FlowFolder.query().insert({
      userId: stranger.id,
      name: 'Stranger Folder',
      color: 'slate',
    })

    const result = await getFlowFolders({}, {}, context)
    expect(result).toEqual([])
  })

  it('excludes flows the user can no longer access from the count', async () => {
    const folder = await FlowFolder.query().insert({
      userId: owner.id,
      name: 'Shared',
      color: 'magenta',
    })

    // A flow owned by someone else, never shared with `owner` - simulates a
    // stale filing record left over from access being revoked.
    const otherOwner = await User.query().insert({
      id: randomUUID(),
      email: 'other-owner@plumber.gov.sg',
    })
    const inaccessibleFlow = await Flow.query().insert({
      id: randomUUID(),
      name: 'inaccessible',
      userId: otherOwner.id,
    })

    await FlowFolderItem.query().insert({
      userId: owner.id,
      flowId: inaccessibleFlow.id,
      folderId: folder.id,
    })

    const result = await getFlowFolders({}, {}, context)
    expect(result.find((f) => f.id === folder.id).flowCount).toEqual(0)
  })
})
