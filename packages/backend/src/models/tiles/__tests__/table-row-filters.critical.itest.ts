/**
 * Business rules pinned by this file:
 *
 * 1. "We should not throw on empty string."
 * 2. "Since `undefined` threw, we should also throw."
 *
 * A lookup value can resolve to an empty string, such as an unanswered
 * optional FormSG field. The filter must still run and match blank cells.
 * Postgres equals and comparison filters already failed on an undefined value.
 */
import { beforeEach, describe, expect, it } from 'vitest'

import {
  generateMockContext,
  generateMockTable,
  generateMockTableColumns,
} from '@/graphql/__tests__/mutations/tiles/table.mock'
import { getTableOperations } from '@/models/tiles/factory'
import { type DatabaseType, TableRowFilterOperator } from '@/models/tiles/types'

describe.each<DatabaseType>(['pg', 'ddb'])(
  'table row filters with an empty-string value (%s)',
  (databaseType) => {
    const tableOperations = getTableOperations(databaseType)
    let tableId: string
    let columnId: string
    let blankRowId: string

    beforeEach(async () => {
      const context = await generateMockContext()
      const { table } = await generateMockTable({
        userId: context.currentUser.id,
        databaseType,
      })
      tableId = table.id
      ;[columnId] = await generateMockTableColumns({
        tableId,
        numColumns: 1,
        databaseType,
      })
      ;[blankRowId] = await tableOperations.createTableRows({
        tableId,
        dataArray: [{ [columnId]: '' }, { [columnId]: 'abc' }],
      })
    })

    it('matches blank cells with equals instead of throwing', async () => {
      const { rows } = await tableOperations.getTableRows({
        tableId,
        columnIds: [columnId],
        filters: [
          {
            columnId,
            operator: TableRowFilterOperator.Equals,
            value: '',
          },
        ],
      })

      expect(rows.map((row) => row.rowId)).toEqual([blankRowId])
    })

    it.each([
      TableRowFilterOperator.Contains,
      TableRowFilterOperator.BeginsWith,
      TableRowFilterOperator.GreaterThan,
      TableRowFilterOperator.GreaterThanOrEquals,
      TableRowFilterOperator.LessThan,
      TableRowFilterOperator.LessThanOrEquals,
    ])('runs the %s filter instead of throwing', async (operator) => {
      await expect(
        tableOperations.getTableRows({
          tableId,
          columnIds: [columnId],
          filters: [{ columnId, operator, value: '' }],
        }),
      ).resolves.toHaveProperty('rows')
    })

    it
      .runIf(databaseType === 'pg')
      .each([
        TableRowFilterOperator.Equals,
        TableRowFilterOperator.GreaterThan,
        TableRowFilterOperator.GreaterThanOrEquals,
        TableRowFilterOperator.LessThan,
        TableRowFilterOperator.LessThanOrEquals,
      ])('throws on the %s filter without a value', async (operator) => {
      await expect(
        tableOperations.getTableRows({
          tableId,
          columnIds: [columnId],
          filters: [{ columnId, operator }],
        }),
      ).rejects.toThrow(`Filter value is required for operator: ${operator}`)
    })
  },
)
