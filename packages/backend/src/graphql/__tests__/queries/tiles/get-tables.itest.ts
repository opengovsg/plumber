import { beforeEach, describe, expect, it } from 'vitest'

import getTables from '@/graphql/queries/tiles/get-tables'
import Context from '@/types/express/context'

import {
  generateMockContext,
  generateMockTable,
  generateMockTableColumns,
} from '../../mutations/tiles/table.mock'

describe('get tables query', () => {
  let context: Context

  // cant use before all here since the data is re-seeded each time
  beforeEach(async () => {
    context = await generateMockContext()
  })
  it('should return array of tables belonging to suers', async () => {
    const numTables = 5
    for (let i = 0; i < numTables; i++) {
      await generateMockTable({ userId: context.currentUser.id })
    }
    const tables = await getTables(null, null, context)
    expect(tables).toHaveLength(numTables)
  })

  it('should return columns', async () => {
    const table = await generateMockTable({
      userId: context.currentUser.id,
    })
    await generateMockTableColumns({ tableId: table.id, numColumns: 5 })
    const tables = await getTables(null, null, context)
    expect(tables[0].columns).to.toHaveLength(5)
  })

  it('should return empty array if no tables found', async () => {
    const tables = await getTables(null, null, context)
    expect(tables).toHaveLength(0)
  })
})
