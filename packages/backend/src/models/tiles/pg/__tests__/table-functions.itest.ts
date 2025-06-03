import { randomUUID } from 'crypto'
import { describe, expect, it } from 'vitest'

import { tilesClient } from '@/config/tiles-database'
import {
  checkIfTableExists,
  checkIfTableHasColumn,
} from '@/graphql/__tests__/mutations/tiles/tiles-pg-helper'

import { createTable } from '../table-functions'

describe('table-functions', () => {
  describe('createTable', () => {
    it('should create a table with specified columns', async () => {
      const testTableId = randomUUID()
      const testColumnIds = [randomUUID(), randomUUID()]
      await createTable(testTableId, testColumnIds)

      // Verify table exists
      const tableExists = await checkIfTableExists(testTableId)
      expect(tableExists).toBe(true)

      // Verify columns exist
      const columnChecks = await Promise.all(
        testColumnIds.map((columnId) =>
          checkIfTableHasColumn(testTableId, columnId),
        ),
      )
      expect(columnChecks.every((exists) => exists)).toBe(true)
    })

    it('should create a table with rowId as primary key', async () => {
      const testTableId = randomUUID()
      const testColumnIds = [randomUUID(), randomUUID()]
      await createTable(testTableId, testColumnIds)

      // Check if rowId column exists and is primary key
      const result = await tilesClient.raw(`
        SELECT a.attname, format_type(a.atttypid, a.atttypmod) AS data_type, 
               i.indisprimary AS is_primary_key
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = '${testTableId}'::regclass
        AND i.indisprimary = true;
      `)

      expect(result.rows.length).toBe(1)
      expect(result.rows[0].attname).toBe('rowId')
      expect(result.rows[0].is_primary_key).toBe(true)
    })

    it('should create a table with timestamp columns', async () => {
      const testTableId = randomUUID()
      await createTable(testTableId, [])

      // Check if created_at and updated_at columns exist
      const timestampColumns = ['createdAt', 'updatedAt']
      const columnChecks = await Promise.all(
        timestampColumns.map((columnName) =>
          checkIfTableHasColumn(testTableId, columnName),
        ),
      )
      expect(columnChecks.every((exists) => exists)).toBe(true)
    })

    it('should throw an error when trying to create a table that already exists', async () => {
      const testTableId = randomUUID()
      await createTable(testTableId, [])

      // Try to create the same table again
      await expect(createTable(testTableId, [])).rejects.toThrow()
    })

    it('should create a table with no additional columns when empty columnIds array is provided', async () => {
      const testTableId = randomUUID()
      await createTable(testTableId, [])

      // Verify table exists
      const tableExists = await checkIfTableExists(testTableId)
      expect(tableExists).toBe(true)

      // Should only have rowId and timestamp columns
      const columns = await tilesClient.raw(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = '${testTableId}';
      `)

      const expectedColumns = ['rowId', 'createdAt', 'updatedAt']
      expect(columns.rows.length).toBe(expectedColumns.length)
      expect(
        columns.rows.map((r: { column_name: string }) => r.column_name).sort(),
      ).toEqual(expectedColumns.sort())
    })
  })
})
