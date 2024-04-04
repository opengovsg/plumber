import { beforeEach, describe, expect, it } from 'vitest'

import createTable from '@/graphql/mutations/tiles/create-table'
import { getTableRowCount } from '@/models/dynamodb/table-row'
import Context from '@/types/express/context'

import { generateMockContext } from './table.mock'

describe('create table mutation', () => {
  let context: Context

  // cant use before all here since the data is re-seeded each time
  beforeEach(async () => {
    context = await generateMockContext()
  })

  it('should create a blank table', async () => {
    const table = await createTable(
      null,
      { input: { name: 'Test Table', isBlank: true } },
      context,
    )
    const tableColumnCount = await table.$relatedQuery('columns').resultSize()
    expect(table.name).toBe('Test Table')
    expect(tableColumnCount).toBe(0)
    const rowCount = await getTableRowCount({ tableId: table.id })
    expect(rowCount).toBe(0)
  })

  it('should create a table and with placeholder rows and columns', async () => {
    const table = await createTable(
      null,
      { input: { name: 'Test Table', isBlank: false } },
      context,
    )
    const tableColumnCount = await table.$relatedQuery('columns').resultSize()
    expect(table.name).toBe('Test Table')
    expect(tableColumnCount).toBe(3)
    const rowCount = await getTableRowCount({ tableId: table.id })
    expect(rowCount).toBe(5)
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
