import { ulid } from 'ulid'
import { beforeEach, describe, expect, it } from 'vitest'

import { TableRowOutputWithTimestamps } from '../../types'
import {
  createTableRow,
  createTableRows,
  getRawRowById,
  getTableRowCount,
} from '../table-row-functions'

import {
  BULK_INSERT_COUNT,
  createMultipleTestRows,
  createTestRowData,
  createTestSetup,
  TestSetup,
} from './table-row-test-utils'

describe('table-row-functions: query operations', () => {
  let setup: TestSetup

  beforeEach(async () => {
    setup = await createTestSetup()
  })

  describe('getTableRowCount', () => {
    it('should return the correct count of rows', async () => {
      let count = await getTableRowCount({ tableId: setup.testTable.id })
      expect(count).toBe(0)

      await createTableRows({
        tableId: setup.testTable.id,
        dataArray: createMultipleTestRows(
          BULK_INSERT_COUNT,
          setup.testColumnIds,
        ),
      })

      count = await getTableRowCount({ tableId: setup.testTable.id })
      expect(count).toBe(BULK_INSERT_COUNT)
    })
  })

  describe('getRawRowById', () => {
    it('should retrieve a specific row by ID', async () => {
      const data = createTestRowData(setup.testColumnIds)

      const { rowId } = await createTableRow({
        tableId: setup.testTable.id,
        data,
      })

      const result = await getRawRowById({
        tableId: setup.testTable.id,
        rowId,
      })

      expect(result).toBeDefined()
      expect(result.data).toEqual(data)
    })

    it('should return null for non-existent row ID', async () => {
      const nonExistentRowId = ulid()

      const result = await getRawRowById({
        tableId: setup.testTable.id,
        rowId: nonExistentRowId,
      })

      expect(result).toBeNull()
    })

    it('should return only specified columns when columnIds is provided', async () => {
      const data = createTestRowData(setup.testColumnIds)

      const { rowId } = await createTableRow({
        tableId: setup.testTable.id,
        data,
      })

      const result = await getRawRowById({
        tableId: setup.testTable.id,
        rowId,
        columnIds: [setup.testColumnIds[0]],
      })

      expect(Object.keys(result.data)).toEqual([setup.testColumnIds[0]])
    })

    it('should include timestamps when includeTimestamps is true', async () => {
      const { rowId } = await createTableRow({
        tableId: setup.testTable.id,
        data: createTestRowData(setup.testColumnIds),
      })

      const result = (await getRawRowById({
        tableId: setup.testTable.id,
        rowId,
        columnIds: setup.testColumnIds,
        includeTimestamps: true,
      })) as TableRowOutputWithTimestamps

      expect(result.createdAt).toBeDefined()
      expect(result.updatedAt).toBeDefined()
    })
  })
})
