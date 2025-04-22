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
  patchTableRow,
  updateTableRow,
} from '../../table-row/functions'

describe('dynamodb table row functions', () => {
  let dummyTable: TableMetadata
  let dummyColumnIds: string[] = []
  let context: Context

  beforeEach(async () => {
    context = await generateMockContext()

    const mockTable = await generateMockTable({
      userId: context.currentUser.id,
    })
    dummyTable = mockTable.table

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
      const { rows } = await getTableRows({
        tableId: dummyTable.id,
        columnIds: ['a', 'b', 'randomcol'],
      })
      expect(rows.length).toEqual(1000)
      // should not include randomcol
      expect(Object.keys(rows[0])).not.toContain('randomcol')
    })

    describe('get table rows with scan limit', () => {
      const TEN_THOUSAND = 10000
      // i tried using beforeAll hook to cut down the setup time, but couldnt get it to work for this nested describe
      beforeEach(async () => {
        const dataArray = []
        for (let i = 0; i < TEN_THOUSAND; i++) {
          dataArray.push(
            generateMockTableRowData({ columnIds: dummyColumnIds }),
          )
        }
        await createTableRows({ tableId: dummyTable.id, dataArray })
      })
      it(
        'should be able to paginate and get a large number of rows',
        {
          timeout: 20000,
        },
        async () => {
          const { rows } = await getTableRows({
            tableId: dummyTable.id,
            columnIds: dummyColumnIds,
          })
          expect(rows).toHaveLength(TEN_THOUSAND)
        },
      )

      it(
        'should be able to paginate and get a large number of rows with a scan limit',
        {
          timeout: 20000,
        },
        async () => {
          const SCAN_LIMIT = 5789
          const { rows } = await getTableRows({
            tableId: dummyTable.id,
            columnIds: dummyColumnIds,
            scanLimit: SCAN_LIMIT,
          })
          expect(rows).toHaveLength(SCAN_LIMIT)
        },
      )
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
      const { rows: rows1 } = await getTableRows({
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
      const { rows: rows2 } = await getTableRows({
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
      const { rows: rows3 } = await getTableRows({
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
      const { rows: rows4 } = await getTableRows({
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
      const { rows: rows5 } = await getTableRows({
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
      const { rows: rows6 } = await getTableRows({
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
      const { rows: rows7 } = await getTableRows({
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
      const { rows: rows8 } = await getTableRows({
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
      const { rows: rows1 } = await getTableRows({
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
      const { rows: rows2 } = await getTableRows({
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
      const { rows: rows3 } = await getTableRows({
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

  describe('patchTableRow', () => {
    it('should patch the data map for the row, leaving other columns unchanged', async () => {
      const data = generateMockTableRowData({
        columnIds: dummyColumnIds,
      })
      const row = await createTableRow({ tableId: dummyTable.id, data })
      const newData = generateMockTableRowData({
        columnIds: [dummyColumnIds[0]],
      })
      const updatedRow = await patchTableRow({
        tableId: dummyTable.id,
        rowId: row.rowId,
        patchData: {
          set: newData,
        },
      })

      expect(updatedRow.data).toEqual({ ...data, ...newData })
    })

    it('should set, add or subtract values for the row', async () => {
      const data = {
        [dummyColumnIds[0]]: 10,
        [dummyColumnIds[1]]: 20,
        [dummyColumnIds[2]]: 30,
      }
      const row = await createTableRow({ tableId: dummyTable.id, data })
      const updatedRow = await patchTableRow({
        tableId: dummyTable.id,
        rowId: row.rowId,
        patchData: {
          set: {
            [dummyColumnIds[0]]: '1',
          },
          add: {
            [dummyColumnIds[1]]: '2',
          },
          subtract: {
            [dummyColumnIds[2]]: '3',
          },
        },
      })

      const expectedData = {
        [dummyColumnIds[0]]: 1,
        [dummyColumnIds[1]]: 22,
        [dummyColumnIds[2]]: 27,
      }

      expect(updatedRow.data).toEqual(expectedData)
    })

    it('should throw a step error if operand is not a number', async () => {
      const data = {
        [dummyColumnIds[0]]: 10,
        [dummyColumnIds[1]]: 20,
        [dummyColumnIds[2]]: 30,
      }
      const row = await createTableRow({ tableId: dummyTable.id, data })

      await expect(
        patchTableRow({
          tableId: dummyTable.id,
          rowId: row.rowId,
          patchData: {
            set: {
              [dummyColumnIds[0]]: '1',
            },
            add: {
              [dummyColumnIds[1]]: 'add',
            },
            subtract: {
              [dummyColumnIds[2]]: '3',
            },
          },
        }),
      ).rejects.toThrow(Error)
    })

    it('should throw a generic error if original value is not a number', async () => {
      const data = {
        [dummyColumnIds[0]]: 10,
        [dummyColumnIds[1]]: 20,
        [dummyColumnIds[2]]: 'string',
      }
      const row = await createTableRow({ tableId: dummyTable.id, data })

      await expect(
        patchTableRow({
          tableId: dummyTable.id,
          rowId: row.rowId,
          patchData: {
            set: {
              [dummyColumnIds[0]]: '1',
            },
            add: {
              [dummyColumnIds[1]]: '2re',
            },
            subtract: {
              [dummyColumnIds[2]]: '3',
            },
          },
        }),
      ).rejects.toThrow(Error)
    })

    it('should work fine if only add/subtract is provided', async () => {
      const data = {
        [dummyColumnIds[0]]: 10,
        [dummyColumnIds[1]]: 20,
        [dummyColumnIds[2]]: 30,
      }
      const row = await createTableRow({ tableId: dummyTable.id, data })

      const updatedRow = await patchTableRow({
        tableId: dummyTable.id,
        rowId: row.rowId,
        patchData: {
          subtract: {
            [dummyColumnIds[2]]: '3',
          },
        },
      })
      expect(updatedRow.data).toEqual({
        [dummyColumnIds[0]]: 10,
        [dummyColumnIds[1]]: 20,
        [dummyColumnIds[2]]: 27,
      })
    })

    it('should not change if no columns are provided', async () => {
      const data = generateMockTableRowData({
        columnIds: dummyColumnIds,
      })
      const row = await createTableRow({ tableId: dummyTable.id, data })
      const updatedRow = await patchTableRow({
        tableId: dummyTable.id,
        rowId: row.rowId,
        patchData: {},
      })

      expect(updatedRow.data).toEqual(data)
    })

    it('should auto-marshall the data', async () => {
      const data = generateMockTableRowData({
        columnIds: dummyColumnIds,
      })
      const row = await createTableRow({ tableId: dummyTable.id, data })
      const updatedRow = await patchTableRow({
        tableId: dummyTable.id,
        rowId: row.rowId,
        patchData: { set: { [dummyColumnIds[0]]: '123' } },
      })
      expect(updatedRow.data).toEqual({ ...data, [dummyColumnIds[0]]: 123 })
    })

    it('should update the updatedAt value', async () => {
      const data = generateMockTableRowData({
        columnIds: dummyColumnIds,
      })
      const row = await createTableRow({ tableId: dummyTable.id, data })
      const updatedRow = await patchTableRow({
        tableId: dummyTable.id,
        rowId: row.rowId,
        patchData: { [dummyColumnIds[0]]: '123' },
      })
      expect(updatedRow.updatedAt).toBeGreaterThan(row.updatedAt)
    })
  })

  describe('GSI', () => {
    it('should get the correct rows with equals operator using GSI', async () => {
      const dataArray = []
      for (let i = 0; i < 1000; i++) {
        const data = generateMockTableRowData({
          columnIds: dummyColumnIds,
        })
        // force the first column to have a deterministic value
        data[dummyColumnIds[0]] = `${i}`
        dataArray.push(data)
      }
      await createTableRows({
        tableId: dummyTable.id,
        dataArray,
        gsi: {
          indexName: 'gsiString1',
          columnIdToMap: dummyColumnIds[0],
        },
      })
      const { rows } = await getTableRows({
        tableId: dummyTable.id,
        gsi: {
          indexName: 'gsiString1',
          filter: {
            columnId: 'skString1',
            operator: TableRowFilterOperator.Equals,
            value: '5',
          },
        },
        includeTimestamps: true,
        scanLimit: 1, // this is to ensure that we are using the index and not scanning all rows
      })
      expect(rows).toHaveLength(1)
    })

    it('should get the correct rows with begins with operator using GSI', async () => {
      const dataArray = []
      for (let i = 0; i < 1000; i++) {
        const data = generateMockTableRowData({
          columnIds: dummyColumnIds,
        })
        // force the first column to have a deterministic value
        data[dummyColumnIds[0]] = `${i}`
        dataArray.push(data)
      }
      await createTableRows({
        tableId: dummyTable.id,
        dataArray,
        gsi: {
          indexName: 'gsiString1',
          columnIdToMap: dummyColumnIds[0],
        },
      })
      const { rows } = await getTableRows({
        tableId: dummyTable.id,
        gsi: {
          indexName: 'gsiString1',
          filter: {
            columnId: 'skString1',
            operator: TableRowFilterOperator.BeginsWith,
            value: '4',
          },
        },
        includeTimestamps: true,
        scanLimit: 111, // this is to ensure that we are using the index and not scanning all rows
      })
      expect(rows).toHaveLength(111)
    })

    it('should automatically convert numbers to strings when using GSI', async () => {
      const dataArray = []
      for (let i = 0; i < 1000; i++) {
        const data = generateMockTableRowData({
          columnIds: dummyColumnIds,
        })
        // force the first column to have a deterministic value
        data[dummyColumnIds[0]] = i as unknown as string
        dataArray.push(data)
      }
      await createTableRows({
        tableId: dummyTable.id,
        dataArray,
        gsi: {
          indexName: 'gsiString1',
          columnIdToMap: dummyColumnIds[0],
        },
      })
      const { rows } = await getTableRows({
        tableId: dummyTable.id,
        gsi: {
          indexName: 'gsiString1',
          filter: {
            columnId: 'skString1',
            operator: TableRowFilterOperator.GreaterThan,
            value: '500',
          },
        },
        includeTimestamps: true,
        scanLimit: 1000,
      })
      expect(rows).toHaveLength(552)
    })

    it('should work with filters', async () => {
      const dataArray = []
      for (let i = 0; i < 1000; i++) {
        const data = generateMockTableRowData({
          columnIds: dummyColumnIds,
        })
        data[dummyColumnIds[0]] = i % 2 === 0 ? 'even' : 'odd'
        data[dummyColumnIds[1]] = `${i}`
        dataArray.push(data)
      }
      await createTableRows({
        tableId: dummyTable.id,
        dataArray,
        gsi: {
          indexName: 'gsiString1',
          columnIdToMap: dummyColumnIds[0],
        },
      })
      const { rows } = await getTableRows({
        tableId: dummyTable.id,
        gsi: {
          indexName: 'gsiString1',
          filter: {
            columnId: 'skString1',
            operator: TableRowFilterOperator.Equals,
            value: 'even',
          },
        },
        filters: [
          {
            columnId: dummyColumnIds[1],
            operator: TableRowFilterOperator.GreaterThan,
            value: '500',
          },
          {
            columnId: dummyColumnIds[1],
            operator: TableRowFilterOperator.LessThanOrEquals,
            value: '700',
          },
        ],
        columnIds: dummyColumnIds,
        scanLimit: 500,
      })
      expect(rows).toHaveLength(100)
    })
  })
})
