import { beforeEach, describe, expect, it } from 'vitest'

import createTable from '@/graphql/mutations/tiles/create-table'
import User from '@/models/user'
import Context from '@/types/express/context'

describe('create table mutation', () => {
  let context: Context

  // cant use before all here since the data is re-seeded each time
  beforeEach(async () => {
    context = {
      req: null,
      res: null,
      currentUser: await User.query().findOne({ email: 'tester@open.gov.sg' }),
    }
  })

  it('should create a table and a column', async () => {
    const table = await createTable(
      null,
      { input: { name: 'Test Table' } },
      context,
    )
    const tableColumnCount = await table.$relatedQuery('columns').resultSize()
    expect(table.name).toBe('Test Table')
    expect(tableColumnCount).toBe(1)
  })

  it('should be able create tables with the same name', async () => {
    const table = await createTable(
      null,
      { input: { name: 'Test Table' } },
      context,
    )

    const table2 = await createTable(
      null,
      { input: { name: 'Test Table' } },
      context,
    )
    expect(table.name).toBe('Test Table')
    expect(table2.name).toBe('Test Table')
  })
})
