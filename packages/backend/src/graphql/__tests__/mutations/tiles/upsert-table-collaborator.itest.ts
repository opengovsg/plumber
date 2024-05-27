import { beforeEach, describe, expect, it } from 'vitest'

import TableMetadata from '@/models/table-metadata'
import User from '@/models/user'
import Context from '@/types/express/context'

import upsertTableCollaborator from '../../../mutations/tiles/upsert-table-collaborator'

import { generateMockContext, generateMockTable } from './table.mock'

describe('update table collaborators', () => {
  let context: Context
  let dummyTable: TableMetadata
  let editor: User
  let owner: User
  let viewer: User

  beforeEach(async () => {
    context = await generateMockContext()

    const mockTable = await generateMockTable({
      userId: context.currentUser.id,
    })
    dummyTable = mockTable.table
    editor = mockTable.editor
    owner = mockTable.owner
    viewer = mockTable.viewer
  })

  it('should be able to add new viewers', async () => {
    await upsertTableCollaborator(
      null,
      {
        input: {
          tableId: dummyTable.id,
          email: 'viewer2@open.gov.sg',
          role: 'viewer',
        },
      },
      context,
    )
    const collaborators = await dummyTable.$relatedQuery('collaborators')
    expect(collaborators).toHaveLength(4)
    const addedCollaborator = collaborators.find(
      (col) => col.email === 'viewer2@open.gov.sg',
    )
    expect(addedCollaborator).toHaveProperty('role', 'viewer')
  })

  it('should be able to add new editors', async () => {
    await upsertTableCollaborator(
      null,
      {
        input: {
          tableId: dummyTable.id,
          email: 'editor2@open.gov.sg',
          role: 'editor',
        },
      },
      context,
    )
    const collaborators = await dummyTable.$relatedQuery('collaborators')
    expect(collaborators).toHaveLength(4)
    const addedCollaborator = collaborators.find(
      (col) => col.email === 'editor2@open.gov.sg',
    )
    expect(addedCollaborator).toHaveProperty('role', 'editor')
  })

  it('should be able to update roles', async () => {
    await upsertTableCollaborator(
      null,
      {
        input: {
          tableId: dummyTable.id,
          email: 'editor@open.gov.sg',
          role: 'viewer',
        },
      },
      context,
    )
    const collaborators = await dummyTable.$relatedQuery('collaborators')
    expect(collaborators).toHaveLength(3)
    const addedCollaborator = collaborators.find(
      (col) => col.email === 'editor@open.gov.sg',
    )
    expect(addedCollaborator).toHaveProperty('role', 'viewer')
  })

  it('should not allow adding of owner role', async () => {
    await expect(
      upsertTableCollaborator(
        null,
        {
          input: {
            tableId: dummyTable.id,
            email: 'owner2@open.gov.sg',
            role: 'owner',
          },
        },
        context,
      ),
    ).rejects.toThrowError('Cannot set collaborator role as owner')
  })

  it('should not allow editing role of owner', async () => {
    context.currentUser = editor
    await expect(
      upsertTableCollaborator(
        null,
        {
          input: {
            tableId: dummyTable.id,
            email: owner.email,
            role: 'editor',
          },
        },
        context,
      ),
    ).rejects.toThrow()
  })

  it('should not allow editing of own role', async () => {
    context.currentUser = editor
    await expect(
      upsertTableCollaborator(
        null,
        {
          input: {
            tableId: dummyTable.id,
            email: context.currentUser.email,
            role: 'editor',
          },
        },
        context,
      ),
    ).rejects.toThrow('Cannot change own role')
  })
  it('should not allow editing of own role', async () => {
    context.currentUser = editor
    await expect(
      upsertTableCollaborator(
        null,
        {
          input: {
            tableId: dummyTable.id,
            email: context.currentUser.email,
            role: 'editor',
          },
        },
        context,
      ),
    ).rejects.toThrow('Cannot change own role')
  })

  it('should only not allow viewers to modify collaborators', async () => {
    context.currentUser = viewer
    await expect(
      upsertTableCollaborator(
        null,
        {
          input: {
            tableId: dummyTable.id,
            email: 'tester33@open.gov.sg',
            role: 'editor',
          },
        },
        context,
      ),
    ).rejects.toThrow('You do not have access to this tile')
  })
})
