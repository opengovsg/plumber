import { beforeEach, describe, expect, it } from 'vitest'

import { selectAllRows } from '@/graphql/__tests__/mutations/tiles/tiles-pg-helper'

import { createTableRow, createTableRows } from '../table-row-functions'

import {
  createMultipleTestRows,
  createTestRowData,
  createTestSetup,
  TestSetup,
} from './table-row-test-utils'

describe('table-row-functions: create operations', () => {
  let setup: TestSetup

  beforeEach(async () => {
    setup = await createTestSetup()
  })

  describe('createTableRow', () => {
    it('should create a single row with the provided data', async () => {
      const data = createTestRowData(setup.testColumnIds)

      const result = await createTableRow({
        tableId: setup.testTable.id,
        data,
      })

      const dbRows = await selectAllRows(setup.testTable.id)
      expect(dbRows).toHaveLength(1)
      expect(dbRows[0].rowId).toBe(result.rowId)
    })

    it('should fail if the data is invalid', async () => {
      const data = createTestRowData(['invalid-column-id'])

      await expect(
        createTableRow({
          tableId: setup.testTable.id,
          data,
        }),
      ).rejects.toThrow()
    })

    it('should cast the data to the correct type', async () => {
      const data = createTestRowData(setup.testColumnIds)

      // @ts-expect-error - we want to test the casting
      data[setup.testColumnIds[0]] = 123

      await expect(
        createTableRow({
          tableId: setup.testTable.id,
          data,
        }),
      ).resolves.not.toThrow()

      const dbRows = await selectAllRows(setup.testTable.id)
      expect(dbRows).toHaveLength(1)
      expect(dbRows[0][setup.testColumnIds[0]]).toBe('123')
    })
  })

  describe('createTableRows', () => {
    it('should create multiple rows with the provided data', async () => {
      const dataArray = createMultipleTestRows(3, setup.testColumnIds)

      const rowIds = await createTableRows({
        tableId: setup.testTable.id,
        dataArray,
      })
      expect(rowIds).toHaveLength(3)

      const dbRows = await selectAllRows(setup.testTable.id)
      expect(dbRows).toHaveLength(3)
    })

    it('should maintain the order of rows created', async () => {
      const dataArray = createMultipleTestRows(3, setup.testColumnIds)

      const rowIds = await createTableRows({
        tableId: setup.testTable.id,
        dataArray,
      })
      expect(rowIds).toHaveLength(3)

      const dbRows = await selectAllRows(setup.testTable.id)
      expect(dbRows).toHaveLength(3)
      expect(dbRows[0][setup.testColumnIds[0]]).toBe(
        dataArray[0][setup.testColumnIds[0]],
      )
      expect(dbRows[1][setup.testColumnIds[0]]).toBe(
        dataArray[1][setup.testColumnIds[0]],
      )
      expect(dbRows[2][setup.testColumnIds[0]]).toBe(
        dataArray[2][setup.testColumnIds[0]],
      )
    })
  })
})
