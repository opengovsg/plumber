import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it } from 'vitest'

import { ForbiddenError } from '@/errors/graphql-errors'
import deleteTable from '@/graphql/mutations/tiles/delete-table'
import TableMetadata from '@/models/table-metadata'
import User from '@/models/user'
import Context from '@/types/express/context'

import {
  generateMockContext,
  generateMockTable,
  generateMockTableColumns,
} from './table.mock'

describe('delete table mutation', () => {
  let context: Context
  let dummyTable: TableMetadata
  let editor: User
  let viewer: User

  beforeEach(async () => {
    context = await generateMockContext()

    const mockTable = await generateMockTable({
      userId: context.currentUser.id,
    })
    dummyTable = mockTable.table
    editor = mockTable.editor
    viewer = mockTable.viewer

    await generateMockTableColumns({
      tableId: dummyTable.id,
      numColumns: 2,
    })
  })

  it('should delete table and columns', async () => {
    const success = await deleteTable(
      null,
      { input: { id: dummyTable.id } },
      context,
    )
    const tableColumnCount = await dummyTable
      .$relatedQuery('columns')
      .resultSize()

    const deletedTable = await TableMetadata.query().findById(dummyTable.id)
    expect(success).toBe(true)
    expect(deletedTable).toBeUndefined()
    expect(tableColumnCount).toBe(0)
  })

  it('should throw an error if table is not found', async () => {
    const deleteTableAction = deleteTable(
      null,
      { input: { id: randomUUID() } },
      context,
    )

    await expect(deleteTableAction).rejects.toThrow()
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
})
