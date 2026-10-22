import { beforeEach, describe, expect, it } from 'vitest'

import { BadUserInputError } from '@/errors/graphql-errors'
import createFlowFolder from '@/graphql/mutations/create-flow-folder'
import FlowFolder from '@/models/flow-folder'
import User from '@/models/user'
import Context from '@/types/express/context'

import { generateMockContext } from './tiles/table.mock'

describe('createFlowFolder', () => {
  let context: Context
  let owner: User

  beforeEach(async () => {
    context = await generateMockContext()
    owner = context.currentUser
  })

  it('creates a folder scoped to the current user', async () => {
    const result = await createFlowFolder(
      null,
      { input: { name: 'My Folder', color: 'teal' } },
      context,
    )

    expect(result.name).toEqual('My Folder')
    expect(result.color).toEqual('teal')
    expect(result.flowCount).toEqual(0)

    const persisted = await FlowFolder.query().findById(result.id)
    expect(persisted.userId).toEqual(owner.id)
  })

  it('trims the name', async () => {
    const result = await createFlowFolder(
      null,
      { input: { name: '  Padded  ', color: 'blue' } },
      context,
    )
    expect(result.name).toEqual('Padded')
  })

  it('rejects an empty name', async () => {
    await expect(
      createFlowFolder(
        null,
        { input: { name: '   ', color: 'blue' } },
        context,
      ),
    ).rejects.toThrow(BadUserInputError)
  })

  it('rejects a colour outside the 6 tokens', async () => {
    await expect(
      createFlowFolder(
        null,
        { input: { name: 'Folder', color: 'purple' } },
        context,
      ),
    ).rejects.toThrow(BadUserInputError)
  })

  it('allows duplicate names for the same user', async () => {
    await createFlowFolder(
      null,
      { input: { name: 'Same Name', color: 'red' } },
      context,
    )
    const second = await createFlowFolder(
      null,
      { input: { name: 'Same Name', color: 'blue' } },
      context,
    )
    expect(second.name).toEqual('Same Name')

    const all = await FlowFolder.query().where('user_id', owner.id)
    expect(all).toHaveLength(2)
  })
})
