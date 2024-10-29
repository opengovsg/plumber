import { beforeEach, describe, expect, it } from 'vitest'

import { ForbiddenError } from '@/errors/graphql-errors'
import deleteRows from '@/graphql/mutations/tiles/delete-rows'
import { createTableRows, getTableRowCount } from '@/models/dynamodb/table-row'
import TableMetadata from '@/models/table-metadata'
import User from '@/models/user'
import Context from '@/types/express/context'

import {
  generateMockContext,
  generateMockTable,
  generateMockTableColumns,
  generateMockTableRowData,
} from './table.mock'

const NUM_ROWS_TO_GENERATE = 35
describe('delete rows mutation', () => {
  let context: Context
  let dummyTable: TableMetadata
  let rowIds: string[] = []
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

    const columnIds = await generateMockTableColumns({
      tableId: dummyTable.id,
      numColumns: 5,
    })

    // populate with some rows
    const dataArray = new Array(NUM_ROWS_TO_GENERATE)
      .fill(null)
      .map(() => generateMockTableRowData({ columnIds }))
    rowIds = await createTableRows({ tableId: dummyTable.id, dataArray })
  })

  it('should delete rows with given ids', async () => {
    const slicedRows = rowIds.slice(0, 5)
    const success = await deleteRows(
      null,
      { input: { tableId: dummyTable.id, rowIds: slicedRows } },
      context,
    )
    expect(success).toEqual(slicedRows)
    const count = await getTableRowCount({ tableId: dummyTable.id })

    expect(count).toEqual(NUM_ROWS_TO_GENERATE - 5)
  })

  it('should be able to delete more than 25 rows', async () => {
    const success = await deleteRows(
      null,
      { input: { tableId: dummyTable.id, rowIds } },
      context,
    )
    const count = await getTableRowCount({ tableId: dummyTable.id })
    expect(success).toEqual(rowIds)

    expect(count).toEqual(0)
  })

  it('should not throw an error if row id does not exist', async () => {
    const invalidRowIds = ['invalid row id 123', 'invalid row id 456']
    await expect(
      deleteRows(
        null,
        { input: { tableId: dummyTable.id, rowIds: invalidRowIds } },
        context,
      ),
    ).resolves.toEqual(invalidRowIds)
  })

  it('should allow collaborators with edit rights to call this function', async () => {
    context.currentUser = editor
    const slicedRows = rowIds.slice(0, 5)
    await expect(
      deleteRows(
        null,
        { input: { tableId: dummyTable.id, rowIds: slicedRows } },
        context,
      ),
    ).resolves.toEqual(slicedRows)
  })

  it('should throw an error if user does not have edit access', async () => {
    context.currentUser = viewer
    const slicedRows = rowIds.slice(0, 5)
    await expect(
      deleteRows(
        null,
        { input: { tableId: dummyTable.id, rowIds: slicedRows } },
        context,
      ),
    ).rejects.toThrow(ForbiddenError)
  })
})
