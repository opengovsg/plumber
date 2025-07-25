import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it } from 'vitest'

import { ForbiddenError } from '@/errors/graphql-errors'
import deleteTable from '@/graphql/mutations/tiles/delete-table'
import TableCollaborator from '@/models/table-collaborators'
import TableMetadata from '@/models/table-metadata'
import { DatabaseType } from '@/models/tiles/types'
import User from '@/models/user'
import Context from '@/types/express/context'

import {
  generateMockContext,
  generateMockTable,
  generateMockTableColumns,
} from './table.mock'

describe.each([['ddb'], ['pg']])(
  'delete table mutation: %s',
  (databaseType: DatabaseType) => {
    let context: Context
    let dummyTable: TableMetadata
    let editor: User
    let viewer: User

    beforeEach(async () => {
      context = await generateMockContext()

      const mockTable = await generateMockTable({
        userId: context.currentUser.id,
        databaseType: databaseType as 'ddb' | 'pg',
      })
      dummyTable = mockTable.table
      editor = mockTable.editor
      viewer = mockTable.viewer

      await generateMockTableColumns({
        tableId: dummyTable.id,
        numColumns: 2,
        databaseType: databaseType as 'ddb' | 'pg',
      })
    })

    it('should delete table, columns and collaborators', async () => {
      const success = await deleteTable(
        null,
        { input: { id: dummyTable.id } },
        context,
      )
      const tableColumnCount = await dummyTable
        .$relatedQuery('columns')
        .resultSize()

      const deletedTable = await TableMetadata.query().findById(dummyTable.id)
      const tableCollaborators = await TableCollaborator.query().where({
        table_id: dummyTable.id,
      })
      expect(success).toBe(true)
      expect(deletedTable).toBeUndefined()
      expect(tableColumnCount).toBe(0)
      expect(tableCollaborators.length).toBe(0)
    })

    it('should throw an error if user is not the owner', async () => {
      context.currentUser = editor
      await expect(
        deleteTable(null, { input: { id: dummyTable.id } }, context),
      ).rejects.toThrow(ForbiddenError)

      context.currentUser = viewer
      await expect(
        deleteTable(null, { input: { id: dummyTable.id } }, context),
      ).rejects.toThrow(ForbiddenError)
    })
  },
)

// Tests that don't need to be run for each database type
describe('delete table mutation - general tests', () => {
  let context: Context

  beforeEach(async () => {
    context = await generateMockContext()
  })

  it('should throw an error if table is not found', async () => {
    const deleteTableAction = deleteTable(
      null,
      { input: { id: randomUUID() } },
      context,
    )

    await expect(deleteTableAction).rejects.toThrow()
  })
})
