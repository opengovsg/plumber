import { randomUUID } from 'crypto'
import { setTimeout as sleep } from 'timers/promises'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { client } from '@/config/database'
import { tilesClient } from '@/config/tiles-database'
import {
  generateMockContext,
  generateMockTable,
  generateMockTableColumns,
} from '@/graphql/__tests__/mutations/tiles/table.mock'
import logger from '@/helpers/logger'
import {
  _batchCreate,
  createTableRows as createDdbRows,
  getTableRows as getDdbRows,
} from '@/models/tiles/dynamodb/table-row/functions'
import { TableRow } from '@/models/tiles/dynamodb/table-row/model'
import {
  clearClaim,
  flipTable,
  migrateTable,
} from '@/models/tiles/migration/migrate-table'
import { createTable } from '@/models/tiles/pg/table-functions'
import { getTableRows as getPgRows } from '@/models/tiles/pg/table-row-functions'

const noDrain = async (): Promise<void> => undefined
const flagOn = async () => true

interface TableState {
  db: string
  migration_started_at: Date | null
  config: Record<string, unknown>
}

async function readTable(tableId: string): Promise<TableState> {
  const { rows } = await client.raw<{ rows: TableState[] }>(
    'SELECT db, migration_started_at, config FROM table_metadata WHERE id = ?',
    [tableId],
  )
  return rows[0]
}

async function setAccessedAgo(tableId: string, minutes: number) {
  await client.raw(
    `UPDATE table_collaborators
     SET last_accessed_at = now() - ? * INTERVAL '1 minute'
     WHERE table_id = ?`,
    [minutes, tableId],
  )
}

async function setClaimAgo(tableId: string, minutes: number): Promise<Date> {
  const { rows } = await client.raw<{ rows: { migration_started_at: Date }[] }>(
    `UPDATE table_metadata
     SET migration_started_at = date_trunc('milliseconds', clock_timestamp() - ? * INTERVAL '1 minute')
     WHERE id = ?
     RETURNING migration_started_at`,
    [minutes, tableId],
  )
  return rows[0].migration_started_at
}

async function seedDdbTile(): Promise<{
  tableId: string
  columnIds: string[]
}> {
  const context = await generateMockContext()
  const { table } = await generateMockTable({
    userId: context.currentUser.id,
    databaseType: 'ddb',
  })
  const columnIds = await generateMockTableColumns({
    tableId: table.id,
    numColumns: 3,
    databaseType: 'ddb',
  })
  await setAccessedAgo(table.id, 60)
  return { tableId: table.id, columnIds }
}

describe('migrateTable', () => {
  let tableId: string
  let columnIds: string[]

  beforeEach(async () => {
    ;({ tableId, columnIds } = await seedDdbTile())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('copies a DynamoDB tile to Postgres and flips it', async () => {
    const [c0, c1, c2] = columnIds
    const base = Date.parse('2026-01-01T00:00:00.000Z')
    const tiedAt = base + 30
    const row = (createdAt: number, data: Record<string, unknown>) => ({
      tableId,
      rowId: randomUUID(),
      createdAt,
      data,
    })
    const emptyRow = row(base + 10, {})
    await _batchCreate([
      row(base + 20, { [c0]: 42, [c1]: 'twenty' }),
      row(base, { [c0]: 'first', 'deleted-column': 'dead' }),
      row(tiedAt, { [c0]: 'tie a' }),
      emptyRow,
      row(tiedAt, { [c0]: 'tie b' }),
      row(tiedAt, { [c0]: 'tie c', [c2]: 3.5 }),
      row(tiedAt, { [c0]: 'tie d' }),
      row(base + 40, { [c1]: 'last' }),
    ])

    await expect(
      migrateTable(tableId, { isFlagOn: flagOn, drain: noDrain }),
    ).resolves.toBe('migrated')

    const state = await readTable(tableId)
    expect(state.db).toBe('pg')
    expect(state.config.migratedFromDdb).toBe(true)
    expect(state.migration_started_at).toBeNull()

    for (const order of ['asc', 'desc'] as const) {
      const ddb = await getDdbRows({ tableId, columnIds, order })
      const pg = await getPgRows({
        tableId,
        columnIds,
        order,
        orderByCreatedAt: true,
      })
      expect(pg.rows.map((r) => r.rowId)).toEqual(ddb.rows.map((r) => r.rowId))
    }

    const pgRows = await tilesClient(tableId).select('*')
    expect(pgRows).toHaveLength(8)
    const byFirstCell = Object.fromEntries(pgRows.map((r) => [r[c0], r]))
    expect(byFirstCell['42'][c1]).toBe('twenty')
    expect(byFirstCell['tie c'][c2]).toBe('3.5')
    expect(byFirstCell.first).not.toHaveProperty('deleted-column')
    const migratedEmptyRow = pgRows.find((r) => r.rowId === emptyRow.rowId)
    expect(columnIds.map((id) => migratedEmptyRow[id])).toEqual([
      null,
      null,
      null,
    ])
    expect(Object.keys(pgRows[0]).sort()).toEqual(
      [...columnIds, 'rowId', 'createdAt', 'updatedAt'].sort(),
    )
  })

  it('keeps the tile on DynamoDB when a row changes after the copy starts', async () => {
    const rowIds = await createDdbRows({
      tableId,
      dataArray: Array.from({ length: 1001 }, (_, i) => ({
        [columnIds[0]]: `row ${i}`,
      })),
    })
    let flagReads = 0
    const isFlagOn = async () => {
      // The second read runs before the second copy page, after row 0 was copied.
      if (++flagReads === 2) {
        await sleep(5)
        await TableRow.patch({ tableId, rowId: rowIds[0] })
          .set({ data: { [columnIds[0]]: 'changed' } })
          .go()
      }
      return true
    }

    const errorSpy = vi.spyOn(logger, 'error')
    await expect(
      migrateTable(tableId, { isFlagOn, drain: noDrain }),
    ).resolves.toBe('failed')
    expect(errorSpy).toHaveBeenCalledWith('tiles-migration.table.failed', {
      tableId,
      err: `Row ${rowIds[0]} changed during the copy`,
    })

    const state = await readTable(tableId)
    expect(state.db).toBe('ddb')
    expect(state.migration_started_at).toBeNull()
    await expect(tilesClient.schema.hasTable(tableId)).resolves.toBe(false)
  })

  it('skips a tile accessed 5 minutes ago', async () => {
    await setAccessedAgo(tableId, 5)
    await expect(
      migrateTable(tableId, { isFlagOn: flagOn, drain: noDrain }),
    ).resolves.toBe('skipped')
    const state = await readTable(tableId)
    expect(state.db).toBe('ddb')
    expect(state.migration_started_at).toBeNull()
  })

  it('skips an excluded tile and keeps its Postgres table', async () => {
    await client.raw(
      `UPDATE table_metadata SET config = config || '{"ddbMigrationExcluded": true}' WHERE id = ?`,
      [tableId],
    )
    await createTable(tableId, columnIds)
    await tilesClient(tableId).insert({ rowId: 'kept', [columnIds[0]]: 'x' })

    await expect(
      migrateTable(tableId, { isFlagOn: flagOn, drain: noDrain }),
    ).resolves.toBe('skipped')

    await expect(tilesClient(tableId).pluck('rowId')).resolves.toEqual(['kept'])
    expect((await readTable(tableId)).migration_started_at).toBeNull()
  })

  describe('flipTable', () => {
    it('does not flip a claim past the commit cutoff and clears it', async () => {
      const claimedAt = await setClaimAgo(tableId, 26)
      await expect(flipTable(tableId, claimedAt)).resolves.toBe(false)
      const state = await readTable(tableId)
      expect(state.db).toBe('ddb')
      expect(state.migration_started_at).toBeNull()
    })

    it('flips a fresh claim', async () => {
      const claimedAt = await setClaimAgo(tableId, 1)
      await expect(flipTable(tableId, claimedAt)).resolves.toBe(true)
      expect((await readTable(tableId)).db).toBe('pg')
    })

    it('does not flip a soft-deleted tile', async () => {
      const claimedAt = await setClaimAgo(tableId, 1)
      await client.raw(
        'UPDATE table_metadata SET deleted_at = now() WHERE id = ?',
        [tableId],
      )
      await expect(flipTable(tableId, claimedAt)).resolves.toBe(false)
      expect((await readTable(tableId)).db).toBe('ddb')
    })

    it("preserves a replacement runner's claim", async () => {
      const staleClaim = await setClaimAgo(tableId, 31)
      const replacementClaim = await setClaimAgo(tableId, 0)

      await expect(flipTable(tableId, staleClaim)).resolves.toBe(false)
      await clearClaim(tableId, staleClaim)

      const state = await readTable(tableId)
      expect(state.db).toBe('ddb')
      expect(state.migration_started_at).toEqual(replacementClaim)
    })
  })
})
