import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it } from 'vitest'

import deleteRow from '@/graphql/mutations/tiles/delete-row'
import { TableRow } from '@/models/dynamodb/table-row'
import TableMetadata from '@/models/table-metadata'
import Context from '@/types/express/context'

import {
  generateMockContext,
  generateMockTable,
  generateMockTableColumns,
  generateMockTableRow,
} from './table.mock'

describe('delete row mutation', () => {
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
    const items = []
    for (let i = 0; i < 5; i++) {
      const rowId = randomUUID()
      items.push({
        tableId: dummyTable.id,
        rowId,
        data: generateMockTableRow({ columnIds }),
      })
      rowIds.push(rowId)
    }
    await TableRow.batchPut(items)
  })

  it('should delete row with given id', async () => {
    const success = await deleteRow(
      null,
      { input: { tableId: dummyTable.id, rowId: rowIds[0] } },
      context,
    )
    const { count } = await TableRow.query({
      tableId: dummyTable.id,
    })
      .count()
      .exec()

    expect(success).toEqual(true)

    expect(count).toEqual(4)
  })

  it('should throw an error if row id does not exist', async () => {
    await expect(
      deleteRow(
        null,
        { input: { tableId: dummyTable.id, rowId: 'invalid row id 123' } },
        context,
      ),
    ).rejects.toThrow()
  })
})
