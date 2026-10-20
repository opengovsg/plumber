import { randomUUID } from 'crypto'
import { ulid } from 'ulid'
import { beforeEach, describe, expect, it } from 'vitest'

import { tilesClient } from '@/config/tiles-database'

import { TableRowOutputWithTimestamps } from '../../types'
import {
  createTableRow,
  createTableRows,
  getRawRowById,
  getTableRowCount,
  getTableRows,
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

  describe('getTableRows ordering', () => {
    // UUID row IDs mimic tiles migrated from DynamoDB, whose rowId order is random.
    let rowIdsByCreatedAt: string[]

    beforeEach(async () => {
      const base = Date.parse('2026-01-01T00:00:00.000Z')
      rowIdsByCreatedAt = Array.from({ length: 6 }, () => randomUUID())
      // Insert in reverse so insertion order cannot explain the result.
      const rows = rowIdsByCreatedAt
        .map((rowId, i) => ({
          rowId,
          createdAt: new Date(base + i * 1000),
          [setup.testColumnIds[0]]: `value-${i}`,
        }))
        .reverse()
      await tilesClient(setup.testTable.id).insert(rows)
    })

    it.each(['asc', 'desc'] as const)(
      'returns rows in createdAt order (%s) when orderByCreatedAt is true',
      async (order) => {
        const { rows } = await getTableRows({
          tableId: setup.testTable.id,
          order,
          orderByCreatedAt: true,
        })
        const expected =
          order === 'asc' ? rowIdsByCreatedAt : [...rowIdsByCreatedAt].reverse()
        expect(rows.map((r) => r.rowId)).toEqual(expected)
      },
    )

    it('breaks createdAt ties by rowId', async () => {
      const tiedAt = new Date('2026-02-01T00:00:00.000Z')
      const tiedRowIds = [randomUUID(), randomUUID()].sort()
      await tilesClient(setup.testTable.id).insert(
        tiedRowIds.map((rowId) => ({ rowId, createdAt: tiedAt })),
      )

      const { rows } = await getTableRows({
        tableId: setup.testTable.id,
        orderByCreatedAt: true,
      })
      expect(rows.slice(-2).map((r) => r.rowId)).toEqual(tiedRowIds)
    })

    it.each(['asc', 'desc'] as const)(
      'keeps rowId order (%s) by default',
      async (order) => {
        const { rows } = await getTableRows({
          tableId: setup.testTable.id,
          order,
        })
        const sorted = [...rowIdsByCreatedAt].sort()
        const expected = order === 'asc' ? sorted : sorted.reverse()
        expect(rows.map((r) => r.rowId)).toEqual(expected)
      },
    )

    it('paginates with offsets in createdAt order', async () => {
      const first = await getTableRows({
        tableId: setup.testTable.id,
        orderByCreatedAt: true,
        scanLimit: 4,
      })
      const second = await getTableRows({
        tableId: setup.testTable.id,
        orderByCreatedAt: true,
        scanLimit: 4,
        stringifiedCursor: first.stringifiedCursor,
      })
      expect([...first.rows, ...second.rows].map((r) => r.rowId)).toEqual(
        rowIdsByCreatedAt,
      )
    })
  })
})
