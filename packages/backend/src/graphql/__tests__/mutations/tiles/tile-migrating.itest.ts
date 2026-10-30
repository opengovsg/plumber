import { randomUUID } from 'crypto'

import { beforeEach, describe, expect, it } from 'vitest'

import tableMetadataResolver from '@/graphql/custom-resolvers/table-metadata'
import createRow from '@/graphql/mutations/tiles/create-row'
import createRows from '@/graphql/mutations/tiles/create-rows'
import deleteRows from '@/graphql/mutations/tiles/delete-rows'
import updateRow from '@/graphql/mutations/tiles/update-row'
import updateTable from '@/graphql/mutations/tiles/update-table'
import getAllRows from '@/graphql/queries/tiles/get-all-rows'
import TableMetadata from '@/models/table-metadata'
import { DatabaseType } from '@/models/tiles/types'
import { addTileColumnsService } from '@/services/mcp/add-tile-columns'
import Context from '@/types/express/context'

import {
  generateMockContext,
  generateMockTable,
  generateMockTableColumns,
} from './table.mock'

const TILE_MIGRATING = { extensions: { code: 'TILE_MIGRATING' } }

async function freezeTable(tableId: string, startedAt: Date): Promise<void> {
  await TableMetadata.query()
    .patch({ migrationStartedAt: startedAt })
    .where({ id: tableId })
}

describe('tiles frozen for migration', () => {
  let context: Context
  let table: TableMetadata
  let columnIds: string[]

  async function setup(databaseType: DatabaseType) {
    context = await generateMockContext()
    const mockTable = await generateMockTable({
      userId: context.currentUser.id,
      databaseType,
    })
    table = mockTable.table
    columnIds = await generateMockTableColumns({
      tableId: table.id,
      numColumns: 2,
      databaseType,
    })
  }

  async function isMigrating(): Promise<boolean> {
    const fresh = await TableMetadata.query().findById(table.id)
    return (
      tableMetadataResolver.isMigrating as unknown as (
        parent: TableMetadata,
      ) => Promise<boolean>
    )(fresh)
  }

  describe('DynamoDB tile with a fresh claim', () => {
    beforeEach(async () => {
      await setup('ddb')
      await freezeTable(table.id, new Date())
    })

    it('rejects createRow', async () => {
      await expect(
        createRow(null, { input: { tableId: table.id, data: {} } }, context),
      ).rejects.toMatchObject(TILE_MIGRATING)
    })

    it('rejects createRows', async () => {
      await expect(
        createRows(
          null,
          { input: { tableId: table.id, dataArray: [{}] } },
          context,
        ),
      ).rejects.toMatchObject(TILE_MIGRATING)
    })

    it('rejects updateRow', async () => {
      await expect(
        updateRow(
          null,
          { input: { tableId: table.id, rowId: randomUUID(), data: {} } },
          context,
        ),
      ).rejects.toMatchObject(TILE_MIGRATING)
    })

    it('rejects deleteRows', async () => {
      await expect(
        deleteRows(
          null,
          { input: { tableId: table.id, rowIds: [randomUUID()] } },
          context,
        ),
      ).rejects.toMatchObject(TILE_MIGRATING)
    })

    it('rejects adding columns', async () => {
      await expect(
        updateTable(
          null,
          { input: { id: table.id, addedColumns: ['New column'] } },
          context,
        ),
      ).rejects.toMatchObject(TILE_MIGRATING)
    })

    it('rejects deleting columns', async () => {
      await expect(
        updateTable(
          null,
          { input: { id: table.id, deletedColumns: [columnIds[0]] } },
          context,
        ),
      ).rejects.toMatchObject(TILE_MIGRATING)
    })

    it('allows renaming the tile', async () => {
      const updated = await updateTable(
        null,
        { input: { id: table.id, name: 'Renamed' } },
        context,
      )
      expect(updated.name).toBe('Renamed')
    })

    it('rejects MCP column adds', async () => {
      await expect(
        addTileColumnsService({
          user: context.currentUser,
          tableId: table.id,
          columns: ['New column'],
        }),
      ).rejects.toThrow('This tile is being upgraded')
    })

    it('reports isMigrating as true', async () => {
      await expect(isMigrating()).resolves.toBe(true)
    })
  })

  describe('DynamoDB tile with a claim past the 30 min lease', () => {
    beforeEach(async () => {
      await setup('ddb')
      await freezeTable(table.id, new Date(Date.now() - 31 * 60 * 1000))
    })

    it('allows createRow', async () => {
      await expect(
        createRow(null, { input: { tableId: table.id, data: {} } }, context),
      ).resolves.toBeDefined()
    })

    it('reports isMigrating as false', async () => {
      await expect(isMigrating()).resolves.toBe(false)
    })
  })

  describe('Postgres tile', () => {
    beforeEach(async () => {
      await setup('pg')
    })

    it('ignores a claim, since only DynamoDB tiles migrate', async () => {
      await freezeTable(table.id, new Date())
      await expect(
        createRow(null, { input: { tableId: table.id, data: {} } }, context),
      ).resolves.toBeDefined()
      await expect(isMigrating()).resolves.toBe(false)
    })

    it('rejects a DynamoDB cursor in getAllRows', async () => {
      await expect(
        getAllRows(
          null,
          { tableId: table.id, stringifiedCursor: '{"rowId":"abc"}' },
          context,
        ),
      ).rejects.toMatchObject(TILE_MIGRATING)
    })

    it('accepts a numeric cursor in getAllRows', async () => {
      await expect(
        getAllRows(
          null,
          { tableId: table.id, stringifiedCursor: '0' },
          context,
        ),
      ).resolves.toBeDefined()
    })
  })
})
