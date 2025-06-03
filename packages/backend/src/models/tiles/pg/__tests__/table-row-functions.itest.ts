import { ulid } from 'ulid'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  generateMockContext,
  generateMockTable,
  generateMockTableColumns,
  generateMockTableRowData,
} from '@/graphql/__tests__/mutations/tiles/table.mock'
import { selectAllRows } from '@/graphql/__tests__/mutations/tiles/tiles-pg-helper'
import TableMetadata from '@/models/table-metadata'
import Context from '@/types/express/context'

import {
  TableRowFilterOperator,
  TableRowOutputWithTimestamps,
} from '../../types'
import {
  createTableRow,
  createTableRows,
  deleteTableRows,
  getRawRowById,
  getTableRowCount,
  getTableRows,
  patchTableRow,
  updateTableRow,
} from '../table-row-functions'

describe('table-row-functions', () => {
  let context: Context
  let dummyTable: TableMetadata
  let dummyColumnIds: string[]

  // cant use before all here since the data is re-seeded each time
  beforeEach(async () => {
    context = await generateMockContext()

    const mockTable = await generateMockTable({
      userId: context.currentUser.id,
      databaseType: 'pg',
    })
    dummyTable = mockTable.table

    dummyColumnIds = await generateMockTableColumns({
      tableId: dummyTable.id,
      numColumns: 5,
      databaseType: 'pg',
    })
  })

  describe('createTableRow', () => {
    it('should create a single row with the provided data', async () => {
      const data = generateMockTableRowData({
        columnIds: dummyColumnIds,
      })

      const result = await createTableRow({
        tableId: dummyTable.id,
        data,
      })

      const dbRows = await selectAllRows(dummyTable.id)

      expect(dbRows).toHaveLength(1)
      expect(dbRows[0].rowId).toBe(result.rowId)
    })

    it('should fail if the data is invalid', async () => {
      const data = generateMockTableRowData({
        columnIds: ['wrong column id'],
      })

      await expect(
        createTableRow({
          tableId: dummyTable.id,
          data,
        }),
      ).rejects.toThrow()
    })

    it('should cast the data to the correct type', async () => {
      const data = generateMockTableRowData({
        columnIds: dummyColumnIds,
      })

      // @ts-expect-error - we want to test the casting
      data[dummyColumnIds[0]] = 123

      await expect(
        createTableRow({
          tableId: dummyTable.id,
          data,
        }),
      ).resolves.not.toThrow()

      const dbRows = await selectAllRows(dummyTable.id)

      expect(dbRows).toHaveLength(1)
      expect(dbRows[0][dummyColumnIds[0]]).toBe('123')
    })
  })

  describe('createTableRows', () => {
    it('should create multiple rows with the provided data', async () => {
      const dataArray = new Array(3).fill(0).map(() =>
        generateMockTableRowData({
          columnIds: dummyColumnIds,
        }),
      )

      const rowIds = await createTableRows({
        tableId: dummyTable.id,
        dataArray,
      })
      expect(rowIds).toHaveLength(3)

      // Verify all rows were created in the database
      const dbRows = await selectAllRows(dummyTable.id)
      expect(dbRows).toHaveLength(3)
    })

    it('should maintain the order of rows created', async () => {
      const dataArray = new Array(3).fill(0).map(() =>
        generateMockTableRowData({
          columnIds: dummyColumnIds,
        }),
      )

      const rowIds = await createTableRows({
        tableId: dummyTable.id,
        dataArray,
      })
      expect(rowIds).toHaveLength(3)

      // Verify all rows were created in the database
      const dbRows = await selectAllRows(dummyTable.id)
      expect(dbRows).toHaveLength(3)
      expect(dbRows[0][dummyColumnIds[0]]).toBe(dataArray[0][dummyColumnIds[0]])
      expect(dbRows[1][dummyColumnIds[0]]).toBe(dataArray[1][dummyColumnIds[0]])
      expect(dbRows[2][dummyColumnIds[0]]).toBe(dataArray[2][dummyColumnIds[0]])
    })
  })

  describe('updateTableRow', () => {
    it('should update an existing row with new data', async () => {
      // Create a row first
      const dataArray = new Array(3).fill(0).map(() =>
        generateMockTableRowData({
          columnIds: dummyColumnIds,
        }),
      )

      const rowIds = await createTableRows({
        tableId: dummyTable.id,
        dataArray,
      })

      await updateTableRow({
        tableId: dummyTable.id,
        rowId: rowIds[0],
        data: dataArray[1],
      })

      // Verify the row was updated
      const dbRows = await selectAllRows(dummyTable.id)
      // remove irrelevant fields
      delete dbRows[0].rowId
      delete dbRows[0].createdAt
      delete dbRows[0].updatedAt
      delete dbRows[1].rowId
      delete dbRows[1].createdAt
      delete dbRows[1].updatedAt
      expect(dbRows[0]).toEqual(dataArray[1])
    })

    it('should throw an error when attempting to update a non-existent row', async () => {
      const nonExistentRowId = ulid()

      await expect(
        updateTableRow({
          tableId: dummyTable.id,
          rowId: nonExistentRowId,
          data: generateMockTableRowData({
            columnIds: dummyColumnIds,
          }),
        }),
      ).rejects.toThrow('Row not found')
    })
  })

  describe('patchTableRow', () => {
    it('should partially update a row with set operation', async () => {
      // Create a row first
      const originalData = generateMockTableRowData({
        columnIds: dummyColumnIds,
      })
      const { rowId } = await createTableRow({
        tableId: dummyTable.id,
        data: originalData,
      })

      const patchData = generateMockTableRowData({
        columnIds: dummyColumnIds.slice(0, 2),
      })

      // Patch only the name
      await patchTableRow({
        tableId: dummyTable.id,
        rowId,
        patchData: {
          set: patchData,
        },
      })

      const dbRows = await selectAllRows(dummyTable.id)
      expect(dbRows[0]).toEqual(
        expect.objectContaining({ ...originalData, ...patchData }),
      )
    })

    it('should update numeric values with add operation', async () => {
      // Create a row with a numeric field
      const { rowId } = await createTableRow({
        tableId: dummyTable.id,
        data: {
          [dummyColumnIds[0]]: '10',
        },
      })

      // Add 5 to the number
      const result = await patchTableRow({
        tableId: dummyTable.id,
        rowId,
        patchData: {
          add: {
            [dummyColumnIds[0]]: '5',
          },
        },
      })

      expect(result.data[dummyColumnIds[0]]).toBe('15')

      const result2 = await patchTableRow({
        tableId: dummyTable.id,
        rowId,
        patchData: {
          add: {
            [dummyColumnIds[0]]: '4.5',
          },
        },
      })

      expect(result2.data[dummyColumnIds[0]]).toBe('19.5')
    })

    it('should update numeric values with subtract operation', async () => {
      // Create a row with a numeric field
      const { rowId } = await createTableRow({
        tableId: dummyTable.id,
        data: {
          [dummyColumnIds[0]]: '10',
        },
      })

      // Add 5 to the number
      const result = await patchTableRow({
        tableId: dummyTable.id,
        rowId,
        patchData: {
          subtract: {
            [dummyColumnIds[0]]: '5',
          },
        },
      })
      expect(result.data[dummyColumnIds[0]]).toBe('5')

      const result2 = await patchTableRow({
        tableId: dummyTable.id,
        rowId,
        patchData: {
          subtract: {
            [dummyColumnIds[0]]: '4.5',
          },
        },
      })

      expect(result2.data[dummyColumnIds[0]]).toBe('0.5')
    })

    it('should throw an error when using add operation with non-numeric value', async () => {
      const { rowId } = await createTableRow({
        tableId: dummyTable.id,
        data: {
          [dummyColumnIds[0]]: 'yorimo anata',
          [dummyColumnIds[1]]: '123',
        },
      })

      await expect(
        patchTableRow({
          tableId: dummyTable.id,
          rowId,
          patchData: {
            add: {
              [dummyColumnIds[0]]: '123',
            },
          },
        }),
      ).rejects.toThrow('Row cannot be patched')

      await expect(
        patchTableRow({
          tableId: dummyTable.id,
          rowId,
          patchData: {
            add: {
              [dummyColumnIds[1]]: 'not-a-number',
            },
          },
        }),
      ).rejects.toThrow('Invalid value for add operation')
    })
  })

  describe('deleteTableRows', () => {
    it('should delete multiple rows by their IDs', async () => {
      // Create some rows
      const dataArray = new Array(3).fill(0).map(() =>
        generateMockTableRowData({
          columnIds: dummyColumnIds,
        }),
      )
      const rowIds = await createTableRows({
        tableId: dummyTable.id,
        dataArray,
      })

      // Delete the first two rows
      await deleteTableRows({
        tableId: dummyTable.id,
        rowIds: [rowIds[0], rowIds[1]],
      })

      // Check that they were deleted
      const dbRows = await selectAllRows(dummyTable.id)
      expect(dbRows).toHaveLength(1)
      expect(dbRows[0].rowId).toBe(rowIds[2])
    })

    // this function is actually not used
    it('should not throw an error when deleting non-existent rows', async () => {
      const nonExistentIds = [ulid(), ulid()]

      // This should not throw
      await expect(
        deleteTableRows({
          tableId: dummyTable.id,
          rowIds: nonExistentIds,
        }),
      ).resolves.not.toThrow()
    })
  })

  describe('getTableRowCount', () => {
    it('should return the correct count of rows', async () => {
      // Initially there should be no rows
      let count = await getTableRowCount({ tableId: dummyTable.id })
      expect(count).toBe(0)

      // Add some rows
      await createTableRows({
        tableId: dummyTable.id,
        dataArray: new Array(33).fill(0).map(() =>
          generateMockTableRowData({
            columnIds: dummyColumnIds,
          }),
        ),
      })

      // Check the count again
      count = await getTableRowCount({ tableId: dummyTable.id })
      expect(count).toBe(33)
    })
  })

  describe('getTableRows', () => {
    let dataArray: Record<string, string>[]
    let rowIds: string[]
    beforeEach(async () => {
      // Add test rows for filtering tests
      dataArray = new Array(5).fill(0).map(() =>
        generateMockTableRowData({
          columnIds: dummyColumnIds,
        }),
      )
      dataArray[0][dummyColumnIds[3]] = '0'
      dataArray[1][dummyColumnIds[3]] = '10'
      dataArray[2][dummyColumnIds[3]] = '20'
      dataArray[3][dummyColumnIds[3]] = '30'
      dataArray[4][dummyColumnIds[3]] = '40'
      rowIds = await createTableRows({
        tableId: dummyTable.id,
        dataArray,
      })
    })

    it('should return all rows when no filters are specified', async () => {
      const result = await getTableRows({ tableId: dummyTable.id })
      expect(result.rows).toHaveLength(5)
    })

    it('should return only specified columns', async () => {
      const result = await getTableRows({
        tableId: dummyTable.id,
        columnIds: [dummyColumnIds[0]],
      })

      expect(result.rows).toHaveLength(5)
      expect(Object.keys(result.rows[0].data)).toEqual([dummyColumnIds[0]])
    })

    it('should filter rows with equals operator', async () => {
      const result = await getTableRows({
        tableId: dummyTable.id,
        filters: [
          {
            columnId: dummyColumnIds[0],
            operator: TableRowFilterOperator.Equals,
            value: dataArray[0][dummyColumnIds[0]],
          },
        ],
      })

      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].rowId).toBe(rowIds[0])
    })

    it('should filter rows with contains operator', async () => {
      const result = await getTableRows({
        tableId: dummyTable.id,
        filters: [
          {
            columnId: dummyColumnIds[1],
            operator: TableRowFilterOperator.Contains,
            value: dataArray[1][dummyColumnIds[1]].slice(4, 12),
          },
        ],
      })

      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].rowId).toBe(rowIds[1])
    })

    it('should filter rows with greaterThan operator', async () => {
      const result = await getTableRows({
        tableId: dummyTable.id,
        filters: [
          {
            columnId: dummyColumnIds[3],
            operator: TableRowFilterOperator.GreaterThan,
            value: '25',
          },
        ],
      })

      expect(result.rows).toHaveLength(2)
      expect(result.rows.map((r) => r.rowId).sort()).toEqual([
        rowIds[3],
        rowIds[4],
      ])
    })

    it('should return rows with pagination using scanLimit and cursor', async () => {
      // First page
      const firstPage = await getTableRows({
        tableId: dummyTable.id,
        scanLimit: 2,
      })

      expect(firstPage.rows).toHaveLength(2)
      expect(firstPage.stringifiedCursor).not.toBeNull()

      // Second page
      const secondPage = await getTableRows({
        tableId: dummyTable.id,
        scanLimit: 2,
        stringifiedCursor: firstPage.stringifiedCursor,
      })

      expect(secondPage.rows).toHaveLength(2)
      expect(secondPage.stringifiedCursor).not.toBeNull()

      // Third page
      const thirdPage = await getTableRows({
        tableId: dummyTable.id,
        scanLimit: 2,
        stringifiedCursor: secondPage.stringifiedCursor,
      })

      expect(thirdPage.rows).toHaveLength(1)
      expect(thirdPage.stringifiedCursor).toBeNull() // No more pages
    })

    it('should order rows in descending order when specified', async () => {
      const result = await getTableRows({
        tableId: dummyTable.id,
        order: 'desc',
      })

      // Since rows are ordered by rowId, which follows creation order,
      // we expect the names to be in reverse creation order
      expect(result.rows[0].rowId).toBe(rowIds[4])
      expect(result.rows[result.rows.length - 1].rowId).toBe(rowIds[0])
    })
  })

  describe('getRawRowById', () => {
    it('should retrieve a specific row by ID', async () => {
      const data = generateMockTableRowData({
        columnIds: dummyColumnIds,
      })

      const { rowId } = await createTableRow({
        tableId: dummyTable.id,
        data,
      })

      const result = await getRawRowById({
        tableId: dummyTable.id,
        rowId,
      })

      expect(result).toBeDefined()
      expect(result.data).toEqual(data)
    })

    it('should return null for non-existent row ID', async () => {
      const nonExistentRowId = ulid()

      const result = await getRawRowById({
        tableId: dummyTable.id,
        rowId: nonExistentRowId,
      })

      expect(result).toBeNull()
    })

    it('should return only specified columns when columnIds is provided', async () => {
      const data = generateMockTableRowData({
        columnIds: dummyColumnIds,
      })

      const { rowId } = await createTableRow({
        tableId: dummyTable.id,
        data,
      })

      const result = await getRawRowById({
        tableId: dummyTable.id,
        rowId,
        columnIds: [dummyColumnIds[0]],
      })

      expect(Object.keys(result.data)).toEqual([dummyColumnIds[0]])
    })

    it('should include timestamps when includeTimestamps is true', async () => {
      const { rowId } = await createTableRow({
        tableId: dummyTable.id,
        data: generateMockTableRowData({
          columnIds: dummyColumnIds,
        }),
      })

      const result = (await getRawRowById({
        tableId: dummyTable.id,
        rowId,
        columnIds: dummyColumnIds,
        includeTimestamps: true,
      })) as TableRowOutputWithTimestamps

      expect(result.createdAt).toBeDefined()
      expect(result.updatedAt).toBeDefined()
    })
  })
})
