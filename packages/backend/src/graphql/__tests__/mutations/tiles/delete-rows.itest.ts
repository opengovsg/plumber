import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it } from 'vitest'

import deleteRow from '@/graphql/mutations/tiles/delete-rows'
import { TableRow } from '@/models/dynamodb/table-row'
import TableMetadata from '@/models/table-metadata'
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
  // cant use before all here since the data is re-seeded each time
  beforeEach(async () => {
    context = await generateMockContext()

    dummyTable = await generateMockTable({
      userId: context.currentUser.id,
    })

    const columnIds = await generateMockTableColumns({
      tableId: dummyTable.id,
      numColumns: 5,
    })

    // populate with some rows
    rowIds = []
    let items = []
    for (let i = 0; i < NUM_ROWS_TO_GENERATE; i++) {
      const rowId = randomUUID()
      items.push({
        tableId: dummyTable.id,
        rowId,
        data: generateMockTableRowData({ columnIds }),
      })
      rowIds.push(rowId)
      if (items.length === 25 || i === NUM_ROWS_TO_GENERATE - 1) {
        await TableRow.batchPut(items)
        items = []
      }
    }
  })

  it('should delete rows with given ids', async () => {
    const slicedRows = rowIds.slice(0, 5)
    const success = await deleteRow(
      null,
      { input: { tableId: dummyTable.id, rowIds: slicedRows } },
      context,
    )
    const { count } = await TableRow.query({
      tableId: dummyTable.id,
    })
      .count()
      .exec()

    expect(success).toEqual(slicedRows)

    expect(count).toEqual(NUM_ROWS_TO_GENERATE - 5)
  })

  it('should be able to delete more than 25 rows', async () => {
    const success = await deleteRow(
      null,
      { input: { tableId: dummyTable.id, rowIds } },
      context,
    )
    const { count } = await TableRow.query({
      tableId: dummyTable.id,
    })
      .count()
      .exec()

    expect(success).toEqual(rowIds)

    expect(count).toEqual(0)
  })

  it('should not throw an error if row id does not exist', async () => {
    const invalidRowIds = ['invalid row id 123', 'invalid row id 456']
    await expect(
      deleteRow(
        null,
        { input: { tableId: dummyTable.id, rowIds: invalidRowIds } },
        context,
      ),
    ).resolves.toEqual(invalidRowIds)
  })
})
