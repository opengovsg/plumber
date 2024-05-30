import { beforeEach, describe, expect, it } from 'vitest'

import getTables from '@/graphql/queries/tiles/get-tables'
import TableCollaborator from '@/models/table-collaborators'
import Context from '@/types/express/context'

import {
  generateMockContext,
  generateMockTable,
} from '../../mutations/tiles/table.mock'

describe('get tables query', () => {
  let context: Context

  // cant use before all here since the data is re-seeded each time
  beforeEach(async () => {
    context = await generateMockContext()
  })
  it('should return array of tables belonging to users', async () => {
    const numTables = 5
    for (let i = 0; i < numTables; i++) {
      await generateMockTable({ userId: context.currentUser.id })
    }
    const tables = await getTables(null, null, context)
    expect(tables).toHaveLength(numTables)
  })

  it('should return empty array if no tables found', async () => {
    const tables = await getTables(null, null, context)
    expect(tables).toHaveLength(0)
  })

  it('should throw an error if collaborator does not exist or is soft deleted', async () => {
    const numTables = 5
    for (let i = 0; i < numTables; i++) {
      await generateMockTable({ userId: context.currentUser.id })
    }
    const tables = await getTables(null, null, context)
    expect(tables).toHaveLength(numTables)
    await TableCollaborator.query()
      .delete()
      .where('table_id', tables[0].id)
      .andWhere('user_id', context.currentUser.id)
    await expect(getTables(null, {}, context)).resolves.toHaveLength(
      numTables - 1,
    )
  })
})
