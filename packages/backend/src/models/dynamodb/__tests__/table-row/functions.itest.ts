import { beforeEach, describe, expect, it } from 'vitest'

import {
  generateMockContext,
  generateMockTable,
  generateMockTableColumns,
  generateMockTableRowData,
} from '@/graphql/__tests__/mutations/tiles/table.mock'
import TableMetadata from '@/models/table-metadata'
import Context from '@/types/express/context'

import { TableRowFilterOperator } from '../../table-row'
import {
  createTableRow,
  createTableRows,
  getRawRowById,
  getTableRowCount,
  getTableRows,
  updateTableRow,
} from '../../table-row/functions'

describe('dynamodb table row functions', () => {
  let dummyTable: TableMetadata
  let dummyColumnIds: string[] = []
  let context: Context

  beforeEach(async () => {
    context = await generateMockContext()
    dummyTable = await generateMockTable({ userId: context.currentUser.id })

    dummyColumnIds = await generateMockTableColumns({
      tableId: dummyTable.id,
      numColumns: 5,
    })
  })

  describe('createTableRow', () => {
    it('should create a single row', async () => {
      const data = generateMockTableRowData({
        columnIds: dummyColumnIds,
      })
      const row = await createTableRow({ tableId: dummyTable.id, data })
      expect(row).toBeDefined()
    })
  })

  describe('createTableRows', () => {
    it('should create multiple rows', async () => {
      const dataArray = new Array(1000)
        .fill(null)
        .map(() => generateMockTableRowData({ columnIds: dummyColumnIds }))
      const rows = await createTableRows({ tableId: dummyTable.id, dataArray })
      expect(rows).toBeDefined()
      expect(rows.length).toEqual(1000)
    })
  })

  describe('getTableRowCount', () => {
    it('should get the correct row count', async () => {
      const dataArray = new Array(1000)
        .fill(null)
        .map(() => generateMockTableRowData({ columnIds: dummyColumnIds }))
      await createTableRows({ tableId: dummyTable.id, dataArray })
      const count = await getTableRowCount({ tableId: dummyTable.id })
      expect(count).toEqual(1000)
    })
  })

  describe('get table rows', async () => {
    it('should get all rows with specified columns', async () => {
      const dataArray = []
      for (let i = 0; i < 1000; i++) {
        dataArray.push({
          a: `${i}`,
          b: `string${i}`,
        })
      }
      await createTableRows({ tableId: dummyTable.id, dataArray })
      const rows = await getTableRows({
        tableId: dummyTable.id,
        columnIds: ['a', 'b', 'randomcol'],
      })
      expect(rows.length).toEqual(1000)
      // should not include randomcol
      expect(Object.keys(rows[0])).not.toContain('randomcol')
    })

    it('should get relevant rows based on a single filter', async () => {
      const dataArray = []
      for (let i = 0; i < 1000; i++) {
        dataArray.push({
          a: `${i}`,
          b: `string${i}`,
        })
      }
      await createTableRows({ tableId: dummyTable.id, dataArray })

      // LTE
      const rows1 = await getTableRows({
        tableId: dummyTable.id,
        columnIds: ['a', 'b'],
        filters: [
          {
            columnId: 'a',
            operator: TableRowFilterOperator.LessThanOrEquals,
            value: '500',
          },
        ],
      })
      expect(rows1.length).toEqual(501)

      // LT
      const rows2 = await getTableRows({
        tableId: dummyTable.id,
        columnIds: ['a', 'b'],
        filters: [
          {
            columnId: 'a',
            operator: TableRowFilterOperator.LessThan,
            value: '500',
          },
        ],
      })
      expect(rows2.length).toEqual(500)

      // GT
      const rows3 = await getTableRows({
        tableId: dummyTable.id,
        columnIds: ['a', 'b'],
        filters: [
          {
            columnId: 'a',
            operator: TableRowFilterOperator.GreaterThan,
            value: '500',
          },
        ],
      })
      expect(rows3.length).toEqual(499)

      // GTE
      const rows4 = await getTableRows({
        tableId: dummyTable.id,
        columnIds: ['a', 'b'],
        filters: [
          {
            columnId: 'a',
            operator: TableRowFilterOperator.GreaterThanOrEquals,
            value: '500',
          },
        ],
      })
      expect(rows4.length).toEqual(500)

      // EQUALS
      const rows5 = await getTableRows({
        tableId: dummyTable.id,
        columnIds: ['a', 'b'],
        filters: [
          {
            columnId: 'a',
            operator: TableRowFilterOperator.Equals,
            value: '500',
          },
        ],
      })
      expect(rows5.length).toEqual(1)

      // Contains
      const rows6 = await getTableRows({
        tableId: dummyTable.id,
        columnIds: ['a', 'b'],
        filters: [
          {
            columnId: 'b',
            operator: TableRowFilterOperator.Contains,
            value: '99',
          },
        ],
      })
      expect(rows6.length).toEqual(19)

      // Contains
      const rows7 = await getTableRows({
        tableId: dummyTable.id,
        columnIds: ['a', 'b'],
        filters: [
          {
            columnId: 'b',
            operator: TableRowFilterOperator.BeginsWith,
            value: 'string9',
          },
        ],
      })
      expect(rows7.length).toEqual(111)

      // Empty
      const rows8 = await getTableRows({
        tableId: dummyTable.id,
        columnIds: ['a', 'b'],
        filters: [
          {
            columnId: 'c',
            operator: TableRowFilterOperator.IsEmpty,
            value: '',
          },
        ],
      })
      expect(rows8.length).toEqual(1000)
    })

    it('should get relevant rows based on composite filters', async () => {
      const dataArray = []
      for (let i = 0; i < 1000; i++) {
        dataArray.push({
          a: `${i}`,
          b: `string${i}`,
        })
      }
      await createTableRows({ tableId: dummyTable.id, dataArray })

      // LTE & GTE
      const rows1 = await getTableRows({
        tableId: dummyTable.id,
        columnIds: ['a', 'b'],
        filters: [
          {
            columnId: 'a',
            operator: TableRowFilterOperator.LessThanOrEquals,
            value: '500',
          },

          {
            columnId: 'a',
            operator: TableRowFilterOperator.GreaterThanOrEquals,
            value: '200',
          },
        ],
      })
      expect(rows1.length).toEqual(301)

      // CONTAINS & BEGINS WITH
      const rows2 = await getTableRows({
        tableId: dummyTable.id,
        columnIds: ['a', 'b'],
        filters: [
          {
            columnId: 'b',
            operator: TableRowFilterOperator.Contains,
            value: '99',
          },
          {
            columnId: 'b',
            operator: TableRowFilterOperator.BeginsWith,
            value: 'string9',
          },
        ],
      })
      expect(rows2.length).toEqual(11)

      // IS EMPTY & EQUALS
      const rows3 = await getTableRows({
        tableId: dummyTable.id,
        columnIds: ['a', 'b'],
        filters: [
          {
            columnId: 'c',
            operator: TableRowFilterOperator.IsEmpty,
            value: '',
          },
          {
            columnId: 'b',
            operator: TableRowFilterOperator.Equals,
            value: 'string999',
          },
        ],
      })
      expect(rows3.length).toEqual(1)
    })
  })

  describe('getRawRowById', () => {
    it('should get a row by id', async () => {
      const data = generateMockTableRowData({
        columnIds: dummyColumnIds,
      })
      const row = await createTableRow({ tableId: dummyTable.id, data })
      const rawRow = await getRawRowById({
        tableId: dummyTable.id,
        rowId: row.rowId,
        columnIds: dummyColumnIds,
      })
      expect(rawRow.data).toEqual(rawRow.data)
    })

    it('should strip out unspecified columns', async () => {
      const data = generateMockTableRowData({
        columnIds: dummyColumnIds,
      })
      const row = await createTableRow({ tableId: dummyTable.id, data })
      const rawRow = await getRawRowById({
        tableId: dummyTable.id,
        rowId: row.rowId,
        columnIds: [dummyColumnIds[0]],
      })
      expect(Object.keys(rawRow.data)).toEqual([dummyColumnIds[0]])
    })
  })

  describe('updateTableRow', () => {
    it('should update the data map for the row', async () => {
      const data = generateMockTableRowData({
        columnIds: dummyColumnIds,
      })
      const newData = generateMockTableRowData({
        columnIds: dummyColumnIds,
      })
      const row = await createTableRow({ tableId: dummyTable.id, data })

      await updateTableRow({
        tableId: dummyTable.id,
        rowId: row.rowId,
        data: newData,
      })
      const updatedRow = await getRawRowById({
        tableId: dummyTable.id,
        rowId: row.rowId,
        columnIds: dummyColumnIds,
      })
      expect(updatedRow.data).toEqual(newData)
    })
  })
})
