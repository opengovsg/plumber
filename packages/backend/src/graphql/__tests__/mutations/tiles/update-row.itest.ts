import { beforeEach, describe, expect, it } from 'vitest'

import updateRow from '@/graphql/mutations/tiles/update-row'
import { createTableRow, TableRow } from '@/models/dynamodb/table-row'
import TableMetadata from '@/models/table-metadata'
import Context from '@/types/express/context'

import {
  generateMockContext,
  generateMockTable,
  generateMockTableColumns,
  generateMockTableRow,
} from './table.mock'

describe('update row mutation', () => {
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

  it('should update a row in a given table', async () => {
    const originalData = generateMockTableRow({ columnIds: dummyColumnIds })

    const rowToUpdate = await createTableRow({
      tableId: dummyTable.id,
      data: originalData,
    })

    const newData = generateMockTableRow({ columnIds: dummyColumnIds })

    const success = await updateRow(
      null,
      {
        input: {
          tableId: dummyTable.id,
          rowId: rowToUpdate.rowId,
          data: newData,
        },
      },
      context,
    )
    const updatedRow = await TableRow.get({
      rowId: rowToUpdate.rowId,
      tableId: dummyTable.id,
    })
    expect(success).toBe(true)
    expect(updatedRow.data).toEqual(newData)
    // check that updatedAt gets updated
    // there's a bug in terms of timestamp return type( ref: https://github.com/dynamoose/dynamoose/issues/1548 )
    // for now we need to cast it because it's either a Date object or a number
    expect(Number(updatedRow.updatedAt)).toBeGreaterThan(
      Number(rowToUpdate.updatedAt),
    )
    // check that createdAt does not change
    expect(Number(updatedRow.createdAt)).toEqual(Number(rowToUpdate.createdAt))
  })

  it('should remove keys that are not specified in the updated data (not a patch operation)', async () => {
    const originalData = generateMockTableRow({ columnIds: dummyColumnIds })
    const rowToUpdate = await createTableRow({
      tableId: dummyTable.id,
      data: originalData,
    })

    const newData = generateMockTableRow({ columnIds: dummyColumnIds.slice(2) })
    const success = await updateRow(
      null,
      {
        input: {
          tableId: dummyTable.id,
          rowId: rowToUpdate.rowId,
          data: newData,
        },
      },
      context,
    )

    const updatedRow = await TableRow.get({
      rowId: rowToUpdate.rowId,
      tableId: dummyTable.id,
    })
    expect(success).toBe(true)
    expect(updatedRow.data).toEqual(newData)
  })

  it('should throw an error if it tries to update a row with new invalid keys', async () => {
    const originalData = generateMockTableRow({ columnIds: dummyColumnIds })
    const rowToUpdate = await createTableRow({
      tableId: dummyTable.id,
      data: originalData,
    })

    const newData = generateMockTableRow({
      columnIds: [...dummyColumnIds, 'invalid_column'],
    })
    await expect(
      updateRow(
        null,
        {
          input: {
            tableId: dummyTable.id,
            rowId: rowToUpdate.rowId,
            data: newData,
          },
        },
        context,
      ),
    ).rejects.toThrow()
  })

  it('should throw an error if row id is not found', async () => {
    await expect(
      updateRow(
        null,
        {
          input: {
            tableId: dummyTable.id,
            rowId: 'random row id',
            data: {},
          },
        },
        context,
      ),
    ).rejects.toThrow()
  })
})
