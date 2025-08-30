import { beforeEach, describe, expect, it } from 'vitest'

import { TableRowFilterOperator } from '../../types'
import { createTableRows, getTableRows } from '../table-row-functions'

import {
  createFilterTestData,
  createTestSetup,
  PAGINATION_PAGE_SIZE,
  TEST_ROW_COUNT,
  TestSetup,
} from './table-row-test-utils'

describe('table-row-functions: filtering and querying', () => {
  let setup: TestSetup
  let testData: Record<string, string>[]
  let rowIds: string[]

  beforeEach(async () => {
    setup = await createTestSetup()
    testData = createFilterTestData(setup.testColumnIds)
    rowIds = await createTableRows({
      tableId: setup.testTable.id,
      dataArray: testData,
    })
  })

  describe('basic querying', () => {
    it('should return all rows when no filters are specified', async () => {
      const result = await getTableRows({ tableId: setup.testTable.id })
      expect(result.rows).toHaveLength(TEST_ROW_COUNT)
    })

    it('should return only specified columns', async () => {
      const result = await getTableRows({
        tableId: setup.testTable.id,
        columnIds: [setup.testColumnIds[0]],
      })

      expect(result.rows).toHaveLength(TEST_ROW_COUNT)
      expect(Object.keys(result.rows[0].data)).toEqual([setup.testColumnIds[0]])
    })

    it('should order rows in descending order when specified', async () => {
      const result = await getTableRows({
        tableId: setup.testTable.id,
        order: 'desc',
      })

      expect(result.rows[0].rowId).toBe(rowIds[TEST_ROW_COUNT - 1])
      expect(result.rows[TEST_ROW_COUNT - 1].rowId).toBe(rowIds[0])
    })
  })

  describe('equals filter', () => {
    it('should filter rows with equals operator (string)', async () => {
      const result = await getTableRows({
        tableId: setup.testTable.id,
        filters: [
          {
            columnId: setup.testColumnIds[0],
            operator: TableRowFilterOperator.Equals,
            value: testData[0][setup.testColumnIds[0]],
          },
        ],
      })

      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].rowId).toBe(rowIds[0])
    })

    it('should filter rows with equals operator (numeric string)', async () => {
      const result = await getTableRows({
        tableId: setup.testTable.id,
        filters: [
          {
            columnId: setup.testColumnIds[3],
            operator: TableRowFilterOperator.Equals,
            value: '5',
          },
        ],
      })

      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].rowId).toBe(rowIds[0])
    })
  })

  describe('contains filter', () => {
    it('should filter rows with contains operator (string)', async () => {
      const result = await getTableRows({
        tableId: setup.testTable.id,
        filters: [
          {
            columnId: setup.testColumnIds[1],
            operator: TableRowFilterOperator.Contains,
            value: testData[1][setup.testColumnIds[1]].slice(4, 12),
          },
        ],
      })

      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].rowId).toBe(rowIds[1])
    })

    it('should filter rows with contains operator (numeric string)', async () => {
      const result = await getTableRows({
        tableId: setup.testTable.id,
        filters: [
          {
            columnId: setup.testColumnIds[3],
            operator: TableRowFilterOperator.Contains,
            value: '4',
          },
        ],
      })

      expect(result.rows).toHaveLength(2)
      expect(result.rows.map((r) => r.rowId).sort()).toEqual([
        rowIds[4],
        rowIds[5],
      ])
    })
  })

  describe('comparison filters', () => {
    describe('greaterThan operator', () => {
      it.each([
        ['20', [3, 4, 5]],
        ['-20', [0, 1, 2, 3, 4, 5, 9]],
        ['0', [0, 1, 2, 3, 4, 5]],
        ['10', [2, 3, 4, 5]],
        ['140', []],
        ['100', [5]],
        ['-0.1', [0, 1, 2, 3, 4, 5]],
        ['-9.99', [0, 1, 2, 3, 4, 5]],
      ])(
        'should filter numeric values correctly (value: %s)',
        async (value: string, expectedRowIndices: number[]) => {
          const result = await getTableRows({
            tableId: setup.testTable.id,
            filters: [
              {
                columnId: setup.testColumnIds[3],
                operator: TableRowFilterOperator.GreaterThan,
                value,
              },
            ],
          })

          expect(result.rows.map((r) => r.rowId).sort()).toEqual(
            expectedRowIndices.map((i) => rowIds[i]),
          )
        },
      )

      it.each([
        ['2024-01-01', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]],
        ['2025-04-01', [4, 5, 6, 7, 8, 9]],
        ['2025-04-02', [4, 5, 6, 7, 8, 9]],
        ['2025-05-01', [5, 6, 7, 8, 9]],
        ['2025-05-01T09:00:00.000', [6, 7, 8, 9]],
        ['2025-05-01T12:00:00.000', [8, 9]],
        ['2025-05-01T00:00:01.000', [6, 7, 8, 9]],
        ['2025-05-02T10:00:00.000', []],
      ])(
        'should filter date values correctly (value: %s)',
        async (value: string, expectedRowIndices: number[]) => {
          const result = await getTableRows({
            tableId: setup.testTable.id,
            filters: [
              {
                columnId: setup.testColumnIds[1],
                operator: TableRowFilterOperator.GreaterThan,
                value,
              },
            ],
          })

          expect(result.rows.map((r) => r.rowId).sort()).toEqual(
            expectedRowIndices.map((i) => rowIds[i]),
          )
        },
      )

      it('should filter rows with greaterThan operator (string)', async () => {
        const result = await getTableRows({
          tableId: setup.testTable.id,
          filters: [
            {
              columnId: setup.testColumnIds[3],
              operator: TableRowFilterOperator.GreaterThan,
              value: 'abc',
            },
          ],
        })

        expect(result.rows).toHaveLength(2)
        expect(result.rows.map((r) => r.rowId).sort()).toEqual([
          rowIds[7],
          rowIds[8],
        ])
      })
    })

    describe('greaterThanOrEquals operator', () => {
      it.each([
        ['20', [2, 3, 4, 5]],
        ['-20', [0, 1, 2, 3, 4, 5, 9]],
        ['0', [0, 1, 2, 3, 4, 5]],
        ['10', [1, 2, 3, 4, 5]],
        ['140', [5]],
        ['100', [5]],
        ['-0.1', [0, 1, 2, 3, 4, 5]],
        ['-9.99', [0, 1, 2, 3, 4, 5, 9]],
      ])(
        'should filter numeric values correctly (value: %s)',
        async (value: string, expectedRowIndices: number[]) => {
          const result = await getTableRows({
            tableId: setup.testTable.id,
            filters: [
              {
                columnId: setup.testColumnIds[3],
                operator: TableRowFilterOperator.GreaterThanOrEquals,
                value,
              },
            ],
          })

          expect(result.rows).toHaveLength(expectedRowIndices.length)
          expect(result.rows.map((r) => r.rowId).sort()).toEqual(
            expectedRowIndices.map((i) => rowIds[i]),
          )
        },
      )

      it.each([
        ['2024-01-01', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]],
        ['2025-04-01', [3, 4, 5, 6, 7, 8, 9]],
        ['2025-04-02', [4, 5, 6, 7, 8, 9]],
        ['2025-05-01', [4, 5, 6, 7, 8, 9]],
        ['2025-05-01T09:00:00.000', [6, 7, 8, 9]],
        ['2025-05-01T12:00:00.000', [7, 8, 9]],
        ['2025-05-01T00:00:01.000', [6, 7, 8, 9]],
        ['2025-05-02T10:00:00.000', []],
      ])(
        'should filter date values correctly (value: %s)',
        async (value: string, expectedRowIndices: number[]) => {
          const result = await getTableRows({
            tableId: setup.testTable.id,
            filters: [
              {
                columnId: setup.testColumnIds[1],
                operator: TableRowFilterOperator.GreaterThanOrEquals,
                value,
              },
            ],
          })

          expect(result.rows.map((r) => r.rowId).sort()).toEqual(
            expectedRowIndices.map((i) => rowIds[i]),
          )
        },
      )

      it('should filter rows with greaterThanOrEquals operator (string)', async () => {
        const result = await getTableRows({
          tableId: setup.testTable.id,
          filters: [
            {
              columnId: setup.testColumnIds[3],
              operator: TableRowFilterOperator.GreaterThanOrEquals,
              value: 'abc',
            },
          ],
        })

        expect(result.rows).toHaveLength(3)
        expect(result.rows.map((r) => r.rowId).sort()).toEqual([
          rowIds[6],
          rowIds[7],
          rowIds[8],
        ])
      })
    })

    describe('lessThan operator', () => {
      it.each([
        ['20', [0, 1, 9]],
        ['-20', []],
        ['0', [9]],
        ['10', [0, 9]],
        ['140', [0, 1, 2, 3, 4, 9]],
        ['100', [0, 1, 2, 3, 4, 9]],
        ['-0.1', [9]],
        ['-9.99', []],
      ])(
        'should filter numeric values correctly (value: %s)',
        async (value: string, expectedRowIndices: number[]) => {
          const result = await getTableRows({
            tableId: setup.testTable.id,
            filters: [
              {
                columnId: setup.testColumnIds[3],
                operator: TableRowFilterOperator.LessThan,
                value,
              },
            ],
          })

          expect(result.rows).toHaveLength(expectedRowIndices.length)
          expect(result.rows.map((r) => r.rowId).sort()).toEqual(
            expectedRowIndices.map((i) => rowIds[i]),
          )
        },
      )

      it.each([
        ['2024-01-01', []],
        ['2025-04-01', [0, 1, 2]],
        ['2025-04-02', [0, 1, 2, 3]],
        ['2025-05-01', [0, 1, 2, 3]],
        ['2025-05-01T09:00:00.000', [0, 1, 2, 3, 4, 5]],
        ['2025-05-01T12:00:00.000', [0, 1, 2, 3, 4, 5, 6]],
        ['2025-05-01T00:00:01.000', [0, 1, 2, 3, 4, 5]],
        ['2025-05-02T10:00:00.000', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]],
      ])(
        'should filter date values correctly (value: %s)',
        async (value: string, expectedRowIndices: number[]) => {
          const result = await getTableRows({
            tableId: setup.testTable.id,
            filters: [
              {
                columnId: setup.testColumnIds[1],
                operator: TableRowFilterOperator.LessThan,
                value,
              },
            ],
          })

          expect(result.rows.map((r) => r.rowId).sort()).toEqual(
            expectedRowIndices.map((i) => rowIds[i]),
          )
        },
      )

      it('should filter rows with lessThan operator (string)', async () => {
        const result = await getTableRows({
          tableId: setup.testTable.id,
          filters: [
            {
              columnId: setup.testColumnIds[3],
              operator: TableRowFilterOperator.LessThan,
              value: 'aaa',
            },
          ],
        })

        expect(result.rows).toHaveLength(7)
        expect(result.rows.map((r) => r.rowId).sort()).toEqual([
          rowIds[0],
          rowIds[1],
          rowIds[2],
          rowIds[3],
          rowIds[4],
          rowIds[5],
          rowIds[9],
        ])
      })
    })

    describe('lessThanOrEquals operator', () => {
      it.each([
        ['20', [0, 1, 2, 9]],
        ['-20', []],
        ['0', [9]],
        ['10', [0, 1, 9]],
        ['140', [0, 1, 2, 3, 4, 5, 9]],
        ['100', [0, 1, 2, 3, 4, 9]],
        ['-0.1', [9]],
        ['-9.99', [9]],
      ])(
        'should filter numeric values correctly (value: %s)',
        async (value: string, expectedRowIndices: number[]) => {
          const result = await getTableRows({
            tableId: setup.testTable.id,
            filters: [
              {
                columnId: setup.testColumnIds[3],
                operator: TableRowFilterOperator.LessThanOrEquals,
                value,
              },
            ],
          })

          expect(result.rows).toHaveLength(expectedRowIndices.length)
          expect(result.rows.map((r) => r.rowId).sort()).toEqual(
            expectedRowIndices.map((i) => rowIds[i]),
          )
        },
      )

      it.each([
        ['2024-01-01', []],
        ['2025-04-01', [0, 1, 2, 3]],
        ['2025-04-02', [0, 1, 2, 3]],
        ['2025-05-01', [0, 1, 2, 3, 4]],
        ['2025-05-01T09:00:00.000', [0, 1, 2, 3, 4, 5]],
        ['2025-05-01T12:00:00.000', [0, 1, 2, 3, 4, 5, 6, 7]],
        ['2025-05-01T00:00:01.000', [0, 1, 2, 3, 4, 5]],
        ['2025-05-02T10:00:00.000', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]],
      ])(
        'should filter date values correctly (value: %s)',
        async (value: string, expectedRowIndices: number[]) => {
          const result = await getTableRows({
            tableId: setup.testTable.id,
            filters: [
              {
                columnId: setup.testColumnIds[1],
                operator: TableRowFilterOperator.LessThanOrEquals,
                value,
              },
            ],
          })

          expect(result.rows.map((r) => r.rowId).sort()).toEqual(
            expectedRowIndices.map((i) => rowIds[i]),
          )
        },
      )

      it('should filter rows with lessThanOrEquals operator (string)', async () => {
        const result = await getTableRows({
          tableId: setup.testTable.id,
          filters: [
            {
              columnId: setup.testColumnIds[3],
              operator: TableRowFilterOperator.LessThanOrEquals,
              value: 'abc',
            },
          ],
        })

        expect(result.rows.map((r) => r.rowId).sort()).toEqual([
          rowIds[0],
          rowIds[1],
          rowIds[2],
          rowIds[3],
          rowIds[4],
          rowIds[5],
          rowIds[6],
          rowIds[9],
        ])
      })
    })
  })

  describe('special filters', () => {
    it('should filter rows with isEmpty operator (nullish, undefined, empty string)', async () => {
      const result = await getTableRows({
        tableId: setup.testTable.id,
        filters: [
          {
            columnId: setup.testColumnIds[2],
            operator: TableRowFilterOperator.IsEmpty,
            value: '',
          },
        ],
      })

      expect(result.rows).toHaveLength(5)
      expect(result.rows.map((r) => r.rowId).sort()).toEqual([
        rowIds[1],
        rowIds[3],
        rowIds[5],
        rowIds[7],
        rowIds[9],
      ])
    })

    it('should filter rows with beginsWith operator (string)', async () => {
      const result = await getTableRows({
        tableId: setup.testTable.id,
        filters: [
          {
            columnId: setup.testColumnIds[2],
            operator: TableRowFilterOperator.BeginsWith,
            value: 'ev',
          },
        ],
      })

      expect(result.rows).toHaveLength(5)
      expect(result.rows.map((r) => r.rowId).sort()).toEqual([
        rowIds[0],
        rowIds[2],
        rowIds[4],
        rowIds[6],
        rowIds[8],
      ])
    })
  })

  describe('pagination', () => {
    it('should return rows with pagination using scanLimit and cursor', async () => {
      const firstPage = await getTableRows({
        tableId: setup.testTable.id,
        scanLimit: PAGINATION_PAGE_SIZE,
      })

      expect(firstPage.rows).toHaveLength(PAGINATION_PAGE_SIZE)
      expect(firstPage.stringifiedCursor).not.toBeNull()

      const secondPage = await getTableRows({
        tableId: setup.testTable.id,
        scanLimit: PAGINATION_PAGE_SIZE,
        stringifiedCursor: firstPage.stringifiedCursor,
      })

      expect(secondPage.rows).toHaveLength(PAGINATION_PAGE_SIZE)
      expect(secondPage.stringifiedCursor).not.toBeNull()

      const thirdPage = await getTableRows({
        tableId: setup.testTable.id,
        scanLimit: 999,
        stringifiedCursor: secondPage.stringifiedCursor,
      })

      expect(thirdPage.rows).toHaveLength(TEST_ROW_COUNT - 8)
      expect(thirdPage.stringifiedCursor).toBeNull()
    })
  })
})
