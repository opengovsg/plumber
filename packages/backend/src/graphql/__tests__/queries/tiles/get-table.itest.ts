import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it } from 'vitest'

import TableMetadataResolver from '@/graphql/custom-resolvers/table-metadata'
import getTable from '@/graphql/queries/tiles/get-table'
import TableMetadata from '@/models/table-metadata'
import Context from '@/types/express/context'

import {
  generateMockContext,
  generateMockTable,
  generateMockTableColumns,
} from '../../mutations/tiles/table.mock'

describe('get single table query', () => {
  let context: Context
  let dummyTable: TableMetadata
  let dummyColumnIds: string[] = []

  // cant use before all here since the data is re-seeded each time
  beforeEach(async () => {
    context = await generateMockContext()

    dummyTable = await generateMockTable({ userId: context.currentUser.id })

    dummyColumnIds = await generateMockTableColumns({
      tableId: dummyTable.id,
      numColumns: 5,
    })
  })
  it('should return table metadata with ordered columns', async () => {
    const table = await getTable(
      null,
      {
        tableId: dummyTable.id,
      },
      context,
    )
    expect(table).toMatchObject({
      id: dummyTable.id,
      name: dummyTable.name,
    })
    const columns = await TableMetadataResolver.columns(dummyTable)
    expect(columns.map((c) => c.id)).toEqual(dummyColumnIds)
  })

  it('should return empty array of columns if no columns exist', async () => {
    const insertedTable = await generateMockTable({
      userId: context.currentUser.id,
    })
    const table = await getTable(
      null,
      {
        tableId: insertedTable.id,
      },
      context,
    )
    const columns = await TableMetadataResolver.columns(table)
    expect(columns).toHaveLength(0)
  })

  it('should throw an error if table does not exist', async () => {
    await expect(
      getTable(
        null,
        {
          tableId: randomUUID(),
        },
        context,
      ),
    ).rejects.toThrow('Table not found')
  })
})
