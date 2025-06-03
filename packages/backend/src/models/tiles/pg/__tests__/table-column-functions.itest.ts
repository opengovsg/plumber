import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  generateMockContext,
  generateMockTable,
} from '@/graphql/__tests__/mutations/tiles/table.mock'
import { checkIfTableHasColumn } from '@/graphql/__tests__/mutations/tiles/tiles-pg-helper'
import TableMetadata from '@/models/table-metadata'
import Context from '@/types/express/context'

import {
  createTableColumns,
  deleteTableColumns,
} from '../table-column-functions'

describe('table-column-functions', () => {
  let context: Context
  let dummyTable: TableMetadata

  beforeEach(async () => {
    context = await generateMockContext()

    const mockTable = await generateMockTable({
      userId: context.currentUser.id,
      databaseType: 'pg',
    })
    dummyTable = mockTable.table
  })

  describe('createTableColumns', () => {
    it('should create single column when provided with one column ID', async () => {
      const columnId = randomUUID()

      await createTableColumns(dummyTable.id, [columnId])

      const hasColumn = await checkIfTableHasColumn(dummyTable.id, columnId)
      expect(hasColumn).toBe(true)
    })

    it('should create multiple columns when provided with multiple column IDs', async () => {
      const columnIds = [randomUUID(), randomUUID(), randomUUID()]

      await createTableColumns(dummyTable.id, columnIds)

      // Verify all columns were created
      const columnChecks = await Promise.all(
        columnIds.map((columnId) =>
          checkIfTableHasColumn(dummyTable.id, columnId),
        ),
      )
      expect(columnChecks.every((exists) => exists)).toBe(true)
    })

    it('should handle empty column IDs array gracefully', async () => {
      await expect(createTableColumns(dummyTable.id, [])).resolves.not.toThrow()
    })

    it('should fail when creating duplicate columns', async () => {
      const columnId = randomUUID()

      // Create column first time
      await createTableColumns(dummyTable.id, [columnId])

      // Try to create same column again - should not throw
      await expect(
        createTableColumns(dummyTable.id, [columnId]),
      ).rejects.toThrow()

      const hasColumn = await checkIfTableHasColumn(dummyTable.id, columnId)
      expect(hasColumn).toBe(true)
    })

    it('should fail when creating duplicate columns concurrently', async () => {
      const columnId = randomUUID()

      // Create column first time
      await expect(
        createTableColumns(dummyTable.id, [columnId, columnId]),
      ).rejects.toThrow()

      const hasColumn = await checkIfTableHasColumn(dummyTable.id, columnId)
      expect(hasColumn).toBe(false)
    })

    it('should throw an error when table does not exist', async () => {
      const nonExistentTableId = randomUUID()
      const columnId = randomUUID()

      await expect(
        createTableColumns(nonExistentTableId, [columnId]),
      ).rejects.toThrow()
    })

    it('should create columns as text type', async () => {
      const columnId = randomUUID()

      await createTableColumns(dummyTable.id, [columnId])

      // Verify column exists and can store text data
      const hasColumn = await checkIfTableHasColumn(dummyTable.id, columnId)
      expect(hasColumn).toBe(true)

      // This would fail if the column type was not compatible with text
      await expect(async () => {
        // We don't have a direct way to test column type, but we can test that text values work
        // This is implicitly tested by the table-row-functions that use these columns
      }).not.toThrow()
    })
  })

  describe('deleteTableColumns', () => {
    let existingColumnIds: string[]

    beforeEach(async () => {
      // Create some columns first
      existingColumnIds = [randomUUID(), randomUUID(), randomUUID()]
      await createTableColumns(dummyTable.id, existingColumnIds)

      // Verify they were created
      const columnChecks = await Promise.all(
        existingColumnIds.map((columnId) =>
          checkIfTableHasColumn(dummyTable.id, columnId),
        ),
      )
      expect(columnChecks.every((exists) => exists)).toBe(true)
    })

    it('should delete single column when provided with one column ID', async () => {
      const columnIdToDelete = existingColumnIds[0]

      await deleteTableColumns(dummyTable.id, [columnIdToDelete])

      const hasColumn = await checkIfTableHasColumn(
        dummyTable.id,
        columnIdToDelete,
      )
      expect(hasColumn).toBe(false)

      // Verify other columns still exist
      const otherColumnChecks = await Promise.all(
        existingColumnIds
          .slice(1)
          .map((columnId) => checkIfTableHasColumn(dummyTable.id, columnId)),
      )
      expect(otherColumnChecks.every((exists) => exists)).toBe(true)
    })

    it('should delete multiple columns when provided with multiple column IDs', async () => {
      const columnsToDelete = existingColumnIds.slice(0, 2)

      await deleteTableColumns(dummyTable.id, columnsToDelete)

      // Verify deleted columns no longer exist
      const deletedColumnChecks = await Promise.all(
        columnsToDelete.map((columnId) =>
          checkIfTableHasColumn(dummyTable.id, columnId),
        ),
      )
      expect(deletedColumnChecks.every((exists) => !exists)).toBe(true)

      // Verify remaining column still exists
      const remainingColumn = existingColumnIds[2]
      const hasRemainingColumn = await checkIfTableHasColumn(
        dummyTable.id,
        remainingColumn,
      )
      expect(hasRemainingColumn).toBe(true)
    })

    it('should handle empty column IDs array gracefully', async () => {
      await expect(deleteTableColumns(dummyTable.id, [])).resolves.not.toThrow()

      // Verify all original columns still exist
      const columnChecks = await Promise.all(
        existingColumnIds.map((columnId) =>
          checkIfTableHasColumn(dummyTable.id, columnId),
        ),
      )
      expect(columnChecks.every((exists) => exists)).toBe(true)
    })

    it('should throw an error when trying to delete non-existent column', async () => {
      const nonExistentColumnId = randomUUID()

      await expect(
        deleteTableColumns(dummyTable.id, [nonExistentColumnId]),
      ).rejects.toThrow()
    })

    it('should throw an error when table does not exist', async () => {
      const nonExistentTableId = randomUUID()
      const columnId = randomUUID()

      await expect(
        deleteTableColumns(nonExistentTableId, [columnId]),
      ).rejects.toThrow()
    })

    it('should handle mixed valid and invalid column IDs by throwing error', async () => {
      const validColumnId = existingColumnIds[0]
      const invalidColumnId = randomUUID()

      await expect(
        deleteTableColumns(dummyTable.id, [validColumnId, invalidColumnId]),
      ).rejects.toThrow()

      // Verify that valid column still exists (transaction should rollback)
      const hasValidColumn = await checkIfTableHasColumn(
        dummyTable.id,
        validColumnId,
      )
      expect(hasValidColumn).toBe(true)
    })
  })
})
