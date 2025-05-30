import { beforeEach, describe, expect, it, vi } from 'vitest'

import createTable from '@/graphql/mutations/tiles/create-table'
import Context from '@/types/express/context'

import { generateMockContext } from './table.mock'
import { checkIfTableExists } from './tiles-pg-helper.mock'

const mocks = vi.hoisted(() => ({
  getTableOperations: {
    createTable: vi.fn().mockResolvedValue(undefined),
    createTableRows: vi
      .fn()
      .mockResolvedValue(['row1', 'row2', 'row3', 'row4', 'row5']),
    getTableRowCount: vi.fn().mockResolvedValue(5),
  },
  getLdFlagValue: vi.fn().mockResolvedValue('pg'),
}))

vi.mock('@/helpers/launch-darkly', () => ({
  getLdFlagValue: mocks.getLdFlagValue,
}))

vi.mock('@/models/tiles/factory', () => ({
  getTableOperations: vi.fn(() => mocks.getTableOperations),
}))

describe('create table mutation', () => {
  let context: Context

  // cant use before all here since the data is re-seeded each time
  beforeEach(async () => {
    context = await generateMockContext()
  })

  it.each([['pg'], ['ddb']])(
    `should create a blank table: %s`,
    async (databaseType) => {
      mocks.getLdFlagValue.mockResolvedValueOnce(databaseType)

      const table = await createTable(
        null,
        { input: { name: 'Test Table', isBlank: true } },
        context,
      )
      const tableColumnCount = await table.$relatedQuery('columns').resultSize()
      expect(table.name).toBe('Test Table')
      expect(tableColumnCount).toBe(0)
      expect(mocks.getTableOperations.createTableRows).not.toHaveBeenCalled()
      expect(mocks.getTableOperations.createTable).toHaveBeenCalledWith(
        table.id,
        [],
      )

      if (databaseType === 'pg') {
        expect(await checkIfTableExists(table.id)).toBe(true)
      }
    },
  )

  it('should create a table and with placeholder rows and columns', async () => {
    const table = await createTable(
      null,
      { input: { name: 'Test Table', isBlank: false } },
      context,
    )
    const tableColumnCount = await table.$relatedQuery('columns').resultSize()
    expect(table.name).toBe('Test Table')
    expect(tableColumnCount).toBe(3)
    expect(mocks.getTableOperations.createTableRows).toHaveBeenCalledWith({
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
})
