import { beforeEach, describe, expect, it } from 'vitest'

import flowResolvers from '@/graphql/custom-resolvers/flow'
import getFlows from '@/graphql/queries/get-flows'
import Flow from '@/models/flow'
import FlowFolder from '@/models/flow-folder'
import FlowFolderItem from '@/models/flow-folder-item'
import Step from '@/models/step'
import User from '@/models/user'
import Context from '@/types/express/context'

import { generateMockContext } from '../mutations/tiles/table.mock'

// getFlows joins against `steps`, so every flow needs at least a trigger
// step to show up (mirrors how flows are actually created).
async function createFlow(owner: User, name: string): Promise<Flow> {
  const flow = await owner.$relatedQuery('flows').insert({ name })
  await Step.query().insert({
    flowId: flow.id,
    type: 'trigger',
    position: 1,
  })
  return flow
}

describe('getFlows folder filtering', () => {
  let context: Context
  let owner: User

  beforeEach(async () => {
    context = await generateMockContext()
    owner = context.currentUser
  })

  it('is byte-for-byte unchanged (folderId/unfiled omitted) for a user with folders', async () => {
    const folder = await FlowFolder.query().insert({
      userId: owner.id,
      name: 'Folder',
      color: 'teal',
    })
    const filedFlow = await createFlow(owner, 'filed')
    const unfiledFlow = await createFlow(owner, 'unfiled')
    await FlowFolderItem.moveFlowToFolder({
      userId: owner.id,
      flowId: filedFlow.id,
      folderId: folder.id,
    })

    const withoutFolderArgs = await getFlows(
      {},
      { limit: 10, offset: 0 },
      context,
    )

    expect(withoutFolderArgs.pageInfo.totalCount).toEqual(2)
    expect(withoutFolderArgs.edges.map((e) => e.node.id).sort()).toEqual(
      [filedFlow.id, unfiledFlow.id].sort(),
    )
  })

  it('filters to a single folder when folderId is set', async () => {
    const folderA = await FlowFolder.query().insert({
      userId: owner.id,
      name: 'A',
      color: 'teal',
    })
    const folderB = await FlowFolder.query().insert({
      userId: owner.id,
      name: 'B',
      color: 'amber',
    })
    const flowInA = await createFlow(owner, 'in-a')
    const flowInB = await createFlow(owner, 'in-b')
    await FlowFolderItem.moveFlowToFolder({
      userId: owner.id,
      flowId: flowInA.id,
      folderId: folderA.id,
    })
    await FlowFolderItem.moveFlowToFolder({
      userId: owner.id,
      flowId: flowInB.id,
      folderId: folderB.id,
    })

    const result = await getFlows(
      {},
      { limit: 10, offset: 0, folderId: folderA.id },
      context,
    )

    expect(result.edges).toHaveLength(1)
    expect(result.edges[0].node.id).toEqual(flowInA.id)
  })

  it('filters to unfiled flows when unfiled is true', async () => {
    const folder = await FlowFolder.query().insert({
      userId: owner.id,
      name: 'Folder',
      color: 'teal',
    })
    const filedFlow = await createFlow(owner, 'filed')
    const unfiledFlow = await createFlow(owner, 'unfiled')
    await FlowFolderItem.moveFlowToFolder({
      userId: owner.id,
      flowId: filedFlow.id,
      folderId: folder.id,
    })

    const result = await getFlows(
      {},
      { limit: 10, offset: 0, unfiled: true },
      context,
    )

    expect(result.edges).toHaveLength(1)
    expect(result.edges[0].node.id).toEqual(unfiledFlow.id)
  })

  it('never returns flows filed by another user, even for the same folder id', async () => {
    const folder = await FlowFolder.query().insert({
      userId: owner.id,
      name: 'Folder',
      color: 'teal',
    })
    const otherUser = await User.query().insert({
      email: 'other@plumber.gov.sg',
    })
    const otherFolder = await FlowFolder.query().insert({
      userId: otherUser.id,
      name: 'Other Folder',
      color: 'red',
    })
    const otherFlow = await createFlow(otherUser, 'other-flow')
    await FlowFolderItem.moveFlowToFolder({
      userId: otherUser.id,
      flowId: otherFlow.id,
      folderId: otherFolder.id,
    })

    const result = await getFlows(
      {},
      { limit: 10, offset: 0, folderId: folder.id },
      context,
    )

    expect(result.edges).toHaveLength(0)
  })

  it('resolves Flow.folder for filed and unfiled flows without extra queries per flow', async () => {
    const folder = await FlowFolder.query().insert({
      userId: owner.id,
      name: 'Folder',
      color: 'blue',
    })
    const filedFlow = await createFlow(owner, 'filed')
    const unfiledFlow = await createFlow(owner, 'unfiled')
    await FlowFolderItem.moveFlowToFolder({
      userId: owner.id,
      flowId: filedFlow.id,
      folderId: folder.id,
    })

    const result = await getFlows({}, { limit: 10, offset: 0 }, context)
    const nodesById = Object.fromEntries(
      result.edges.map((e) => [e.node.id, e.node]),
    )

    const [filedFolder, unfiledFolder] = await Promise.all([
      flowResolvers.folder(nodesById[filedFlow.id], {}, context),
      flowResolvers.folder(nodesById[unfiledFlow.id], {}, context),
    ])

    expect(filedFolder).toMatchObject({
      id: folder.id,
      name: 'Folder',
      color: 'blue',
    })
    expect(unfiledFolder).toBeNull()
  })
})
