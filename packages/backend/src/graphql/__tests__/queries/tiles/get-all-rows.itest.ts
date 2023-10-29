import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it } from 'vitest'

import getAllRows from '@/graphql/queries/tiles/get-all-rows'
import TableMetadata from '@/models/table-metadata'
import Context from '@/types/express/context'

import {
  generateMockContext,
  generateMockTable,
  generateMockTableColumns,
  generateMockTableRowData,
} from '../../mutations/tiles/table.mock'

import { insertMockTableRows } from './table-row.mock'

describe('get all rows query', () => {
  let context: Context
  let dummyTable: TableMetadata
  let dummyColumnIds: string[] = []

  // cant use before all here since the data is re-seeded each time
  beforeEach(async () => {
    context = await generateMockContext()

    dummyTable = await generateMockTable({ userId: context.currentUser.id })

    dummyColumnIds = await generateMockTableColumns({
      tableId: dummyTable.id,
      numColumns: 5,
    })
  })

  it('should fetch all rows in a given table', async () => {
    const numRowsToInsert = 100
    const rowsToInsert = []
    for (let i = 0; i < numRowsToInsert; i++) {
      const data = generateMockTableRowData({ columnIds: dummyColumnIds })
      rowsToInsert.push({
        tableId: dummyTable.id,
        rowId: randomUUID(),
        data,
        createdAt: Date.now(),
      })
    }

    await insertMockTableRows(rowsToInsert)

    const rows = await getAllRows(
      null,
      {
        input: {
          tableId: dummyTable.id,
        },
      },
      context,
    )
    expect(rows).toHaveLength(numRowsToInsert)
  })

  it('should return rows in ascending order of createdAt', async () => {
    // Insert rows in descending order of createdAt
    const numRowsToInsert = 10
    const currentDate = Date.now()
    const rowsToInsert = []
    for (let i = 0; i < numRowsToInsert; i++) {
      const rowId = randomUUID()
      rowsToInsert.push({
        rowId,
        tableId: dummyTable.id,
        data: {},
        createdAt: currentDate - i,
      })
    }
    await insertMockTableRows(rowsToInsert)

    const rows = await getAllRows(
      null,
      {
        input: {
          tableId: dummyTable.id,
        },
      },
      context,
    )

    // Get row ids in ascending order of createdAt
    const expectedOrderedRowIds = rowsToInsert.map((r) => r.rowId).reverse()

    expect(rows.map((r) => r.rowId)).toEqual(expectedOrderedRowIds)
  })

  it('should fetch all rows even if more than 1MB', async () => {
    // 1 randomly generated row is about 470 bytes
    // 4000 rows will be about about 1.8MB
    const numRowsToInsert = 4000
    const rowsToInsert = []
    for (let i = 0; i < numRowsToInsert; i++) {
      const data = generateMockTableRowData({ columnIds: dummyColumnIds })
      rowsToInsert.push({
        tableId: dummyTable.id,
        rowId: randomUUID(),
        data,
        createdAt: Date.now(),
      })
    }

    await insertMockTableRows(rowsToInsert)

    const rows = await getAllRows(
      null,
      {
        input: {
          tableId: dummyTable.id,
        },
      },
      context,
    )

    expect(rows).toHaveLength(numRowsToInsert)
  }, 100000)

  it('should return empty array if no rows', async () => {
    const rows = await getAllRows(
      null,
      {
        input: {
          tableId: dummyTable.id,
        },
      },
      context,
    )

    expect(rows).toHaveLength(0)
  })

  it('should strip keys that are not in table columns', async () => {
    const data = generateMockTableRowData({ columnIds: dummyColumnIds })
    // add a key that is not in the table columns
    data[randomUUID()] = 'test'
    const rowToInsert = {
      tableId: dummyTable.id,
      rowId: randomUUID(),
      data,
      createdAt: Date.now(),
    }

    await insertMockTableRows([rowToInsert])

    const rows = await getAllRows(
      null,
      {
        input: {
          tableId: dummyTable.id,
        },
      },
      context,
    )

    expect(Object.keys(rows[0].data).sort()).toEqual(dummyColumnIds.sort())
  })
})
