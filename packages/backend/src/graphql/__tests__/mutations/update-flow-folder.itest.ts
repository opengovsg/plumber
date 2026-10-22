import { randomUUID } from 'crypto'
import { NotFoundError } from 'objection'
import { beforeEach, describe, expect, it } from 'vitest'

import { BadUserInputError } from '@/errors/graphql-errors'
import updateFlowFolder from '@/graphql/mutations/update-flow-folder'
import FlowFolder from '@/models/flow-folder'
import User from '@/models/user'
import Context from '@/types/express/context'

import { generateMockContext } from './tiles/table.mock'

describe('updateFlowFolder', () => {
  let context: Context
  let owner: User
  let folder: FlowFolder

  beforeEach(async () => {
    context = await generateMockContext()
    owner = context.currentUser
    folder = await FlowFolder.query().insert({
      userId: owner.id,
      name: 'Original',
      color: 'teal',
    })
  })

  it('renames a folder', async () => {
    const result = await updateFlowFolder(
      null,
      { input: { id: folder.id, name: 'Renamed' } },
      context,
    )
    expect(result.name).toEqual('Renamed')
    expect(result.color).toEqual('teal')
  })

  it('changes only the colour when name is omitted', async () => {
    const result = await updateFlowFolder(
      null,
      { input: { id: folder.id, color: 'amber' } },
      context,
    )
    expect(result.name).toEqual('Original')
    expect(result.color).toEqual('amber')
  })

  it('rejects an invalid colour', async () => {
    await expect(
      updateFlowFolder(
        null,
        { input: { id: folder.id, color: 'purple' } },
        context,
      ),
    ).rejects.toThrow(BadUserInputError)
  })

  it('rejects an empty name', async () => {
    await expect(
      updateFlowFolder(
        null,
        { input: { id: folder.id, name: '   ' } },
        context,
      ),
    ).rejects.toThrow(BadUserInputError)
  })

  it("never updates another user's folder", async () => {
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
      updateFlowFolder(
        null,
        { input: { id: strangerFolder.id, name: 'Hijacked' } },
        context,
      ),
    ).rejects.toThrow(NotFoundError)

    const unchanged = await FlowFolder.query().findById(strangerFolder.id)
    expect(unchanged.name).toEqual('Stranger Folder')
  })
})
