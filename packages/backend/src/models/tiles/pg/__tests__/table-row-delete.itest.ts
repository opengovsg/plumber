import { ulid } from 'ulid'
import { beforeEach, describe, expect, it } from 'vitest'

import { selectAllRows } from '@/graphql/__tests__/mutations/tiles/tiles-pg-helper'

import { createTableRows, deleteTableRows } from '../table-row-functions'

import {
  createMultipleTestRows,
  createTestSetup,
  TestSetup,
} from './table-row-test-utils'

describe('table-row-functions: delete operations', () => {
  let setup: TestSetup

  beforeEach(async () => {
    setup = await createTestSetup()
  })

  describe('deleteTableRows', () => {
    it('should delete multiple rows by their IDs', async () => {
      const dataArray = createMultipleTestRows(3, setup.testColumnIds)
      const rowIds = await createTableRows({
        tableId: setup.testTable.id,
        dataArray,
      })

      await deleteTableRows({
        tableId: setup.testTable.id,
        rowIds: [rowIds[0], rowIds[1]],
      })

      const dbRows = await selectAllRows(setup.testTable.id)
      expect(dbRows).toHaveLength(1)
      expect(dbRows[0].rowId).toBe(rowIds[2])
    })

    it('should not throw an error when deleting non-existent rows', async () => {
      const nonExistentIds = [ulid(), ulid()]

      await expect(
        deleteTableRows({
          tableId: setup.testTable.id,
          rowIds: nonExistentIds,
        }),
      ).resolves.not.toThrow()
    })
  })
})
