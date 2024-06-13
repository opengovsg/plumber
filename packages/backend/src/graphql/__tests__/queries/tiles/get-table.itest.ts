import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it } from 'vitest'

import TableMetadataResolver from '@/graphql/custom-resolvers/table-metadata'
import getTable from '@/graphql/queries/tiles/get-table'
import TableCollaborator from '@/models/table-collaborators'
import TableMetadata from '@/models/table-metadata'
import User from '@/models/user'
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
  let editor: User
  let viewer: User

  beforeEach(async () => {
    context = await generateMockContext()

    const mockTable = await generateMockTable({
      userId: context.currentUser.id,
    })
    dummyTable = mockTable.table
    editor = mockTable.editor
    viewer = mockTable.viewer

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

    const columns = await TableMetadataResolver.columns(dummyTable, {}, null)
    expect(columns.map((c) => c.id)).toEqual(dummyColumnIds)
  })

  it('should return table metadata with role', async () => {
    const table = await getTable(
      null,
      {
        tableId: dummyTable.id,
      },
      context,
    )
    expect(table.role).toBe('owner')
  })

  it('should return empty array of columns if no columns exist', async () => {
    const { table: insertedTable } = await generateMockTable({
      userId: context.currentUser.id,
    })
    const table = await getTable(
      null,
      {
        tableId: insertedTable.id,
      },
      context,
    )
    const columns = await TableMetadataResolver.columns(table, {}, null)
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

  it('should throw an error if collaborator does not exist or is soft deleted', async () => {
    context.currentUser = editor
    await TableCollaborator.query()
      .delete()
      .where('table_id', dummyTable.id)
      .andWhere('user_id', editor.id)
    await expect(
      getTable(
        null,
        {
          tableId: dummyTable.id,
        },
        context,
      ),
    ).rejects.toThrow('Table not found')
  })

  it('should allow all collaborators to call this function', async () => {
    context.currentUser = editor
    await expect(
      getTable(
        null,
        {
          tableId: dummyTable.id,
        },
        context,
      ),
    ).resolves.toBeDefined()

    context.currentUser = viewer
    await expect(
      getTable(
        null,
        {
          tableId: dummyTable.id,
        },
        context,
      ),
    ).resolves.toBeDefined()
  })

  it('should return all collaborators ordered by roles', async () => {
    const table = await getTable(
      null,
      {
        tableId: dummyTable.id,
      },
      context,
    )
    const collaborators = await TableMetadataResolver.collaborators(
      table,
      {},
      null,
    )
    expect(collaborators).toEqual([
      { email: context.currentUser.email, role: 'owner' },
      { email: editor.email, role: 'editor' },
      { email: viewer.email, role: 'viewer' },
    ])
  })
})
