import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it } from 'vitest'

import getUnfiledFlowCount from '@/graphql/queries/get-unfiled-flow-count'
import Flow from '@/models/flow'
import FlowFolder from '@/models/flow-folder'
import FlowFolderItem from '@/models/flow-folder-item'
import Step from '@/models/step'
import User from '@/models/user'
import Context from '@/types/express/context'

import { generateMockContext } from '../mutations/tiles/table.mock'

// getFlows/getUnfiledFlowCount join against `steps`, so every flow needs at
// least a trigger step to show up (mirrors how flows are actually created).
async function createFlow(owner: User, name: string): Promise<Flow> {
  const flow = await owner.$relatedQuery('flows').insert({ name })
  await Step.query().insert({
    flowId: flow.id,
    type: 'trigger',
    position: 1,
  })
  return flow
}

describe('getUnfiledFlowCount', () => {
  let context: Context
  let owner: User

  beforeEach(async () => {
    context = await generateMockContext()
    owner = context.currentUser
  })

  it('returns 0 for a user with no flows', async () => {
    const result = await getUnfiledFlowCount({}, {}, context)
    expect(result).toEqual(0)
  })

  it('counts only flows not filed into any folder', async () => {
    const folder = await FlowFolder.query().insert({
      userId: owner.id,
      name: 'Folder',
      color: 'teal',
    })
    const filedFlow = await createFlow(owner, 'filed')
    await createFlow(owner, 'unfiled-1')
    await createFlow(owner, 'unfiled-2')

    await FlowFolderItem.moveFlowToFolder({
      userId: owner.id,
      flowId: filedFlow.id,
      folderId: folder.id,
    })

    const result = await getUnfiledFlowCount({}, {}, context)
    expect(result).toEqual(2)
  })

  it('excludes flows the user cannot access', async () => {
    const otherOwner = await User.query().insert({
      id: randomUUID(),
      email: 'other-owner@plumber.gov.sg',
    })
    await createFlow(otherOwner, 'not-mine')
    await createFlow(owner, 'mine')

    const result = await getUnfiledFlowCount({}, {}, context)
    expect(result).toEqual(1)
  })
})
