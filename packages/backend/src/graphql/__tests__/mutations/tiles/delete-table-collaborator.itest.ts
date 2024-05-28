import { beforeEach, describe, expect, it } from 'vitest'

import TableMetadata from '@/models/table-metadata'
import User from '@/models/user'
import Context from '@/types/express/context'

import deleteTableCollaborator from '../../../mutations/tiles/delete-table-collaborator'

import { generateMockContext, generateMockTable } from './table.mock'

describe('delete table collaborators', () => {
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

  it('should be able to delete collaborators', async () => {
    await deleteTableCollaborator(
      null,
      {
        input: {
          tableId: dummyTable.id,
          email: viewer.email,
        },
      },
      context,
    )
    const collaborators = await dummyTable
      .$relatedQuery('collaborators')
      .select('email', 'role', 'table_collaborators.deleted_at')
      .where('table_collaborators.deleted_at', null)
    expect(collaborators).toHaveLength(2)
    const addedCollaborator = collaborators.find(
      (col) => col.email === viewer.email,
    )
    expect(addedCollaborator).toBeUndefined()
  })

  it('should throw an error if collaborator is not found', async () => {
    await expect(
      deleteTableCollaborator(
        null,
        {
          input: {
            tableId: dummyTable.id,
            email: 'viewer2@open.gov.sg',
          },
        },
        context,
      ),
    ).rejects.toThrow()
  })

  it('should not delete owner role', async () => {
    context.currentUser = editor
    await deleteTableCollaborator(
      null,
      {
        input: {
          tableId: dummyTable.id,
          email: owner.email,
        },
      },
      context,
    )
    const collaborators = await dummyTable
      .$relatedQuery('collaborators')
      .where('table_collaborators.deleted_at', null)
    expect(collaborators).toHaveLength(3)
  })

  it('should not allow deleting of oneself', async () => {
    context.currentUser = editor
    await expect(
      deleteTableCollaborator(
        null,
        {
          input: {
            tableId: dummyTable.id,
            email: editor.email,
          },
        },
        context,
      ),
    ).rejects.toThrow()
  })
})
