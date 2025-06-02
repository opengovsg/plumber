import { beforeEach, describe, expect, it, vi } from 'vitest'

import createTable from '@/graphql/mutations/tiles/create-table'
import * as ddbTableRowFunctions from '@/models/tiles/dynamodb/table-row/functions'
import * as pgTableFunctions from '@/models/tiles/pg/table-functions'
import * as pgTableRowFunctions from '@/models/tiles/pg/table-row-functions'
import { DatabaseType } from '@/models/tiles/types'
import Context from '@/types/express/context'

import { generateMockContext } from './table.mock'
import { checkIfTableExists } from './tiles-pg-helper'

const pgCreateTableSpy = vi.spyOn(pgTableFunctions, 'createTable')
const pgCreateTableRowsSpy = vi.spyOn(pgTableRowFunctions, 'createTableRows')
const ddbCreateTableRowsSpy = vi.spyOn(ddbTableRowFunctions, 'createTableRows')

const mocks = vi.hoisted(() => ({
  getLdFlagValue: vi.fn().mockResolvedValue('pg'),
}))

vi.mock('@/helpers/launch-darkly', () => ({
  getLdFlagValue: mocks.getLdFlagValue,
}))

describe.each([['pg'], ['ddb']])(
  'create table mutation: %s',
  (databaseType: DatabaseType) => {
    let context: Context

    // cant use before all here since the data is re-seeded each time
    beforeEach(async () => {
      context = await generateMockContext()
      pgCreateTableSpy.mockClear()
      pgCreateTableRowsSpy.mockClear()
      ddbCreateTableRowsSpy.mockClear()
    })

    it('should create a blank table', async () => {
      mocks.getLdFlagValue.mockResolvedValueOnce(databaseType)
      const table = await createTable(
        null,
        { input: { name: 'Test Table', isBlank: true } },
        context,
      )
      const tableColumnCount = await table.$relatedQuery('columns').resultSize()
      expect(table.name).toBe('Test Table')
      expect(tableColumnCount).toBe(0)
      expect(pgCreateTableRowsSpy).not.toHaveBeenCalled()
      expect(ddbCreateTableRowsSpy).not.toHaveBeenCalled()
      if (databaseType === 'pg') {
        expect(pgCreateTableSpy).toHaveBeenCalledWith(table.id, [])
        // we check if the table is actually created here
        expect(await checkIfTableExists(table.id)).toBe(true)
      }
    })

    it('should create a table and with placeholder rows and columns', async () => {
      mocks.getLdFlagValue.mockResolvedValueOnce(databaseType)
      const table = await createTable(
        null,
        { input: { name: 'Test Table', isBlank: false } },
        context,
      )
      const tableColumnCount = await table.$relatedQuery('columns').resultSize()
      expect(table.name).toBe('Test Table')
      expect(tableColumnCount).toBe(3)

      expect(
        databaseType === 'pg' ? pgCreateTableRowsSpy : ddbCreateTableRowsSpy,
      ).toHaveBeenCalledWith({
        tableId: table.id,
        dataArray: new Array(5).fill({}),
      })
    })

    it('should be able create tables with the same name', async () => {
      const table = await createTable(
        null,
        { input: { name: 'Test Table', isBlank: false } },
        context,
      )

      const table2 = await createTable(
        null,
        { input: { name: 'Test Table', isBlank: false } },
        context,
      )
      expect(table.name).toBe('Test Table')
      expect(table2.name).toBe('Test Table')
    })

    it('should throw an error when table name is empty', async () => {
      await expect(
        createTable(null, { input: { name: '', isBlank: false } }, context),
      ).rejects.toThrow()
    })
  },
)
