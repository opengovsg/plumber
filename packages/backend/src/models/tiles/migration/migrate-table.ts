import type { Knex } from 'knex'
import { performance } from 'perf_hooks'
import { setTimeout as sleep } from 'timers/promises'

import { client } from '@/config/database'
import { tilesClient } from '@/config/tiles-database'
import logger from '@/helpers/logger'
import TableColumnMetadata from '@/models/table-column-metadata'
import { TableRow } from '@/models/tiles/dynamodb/table-row/model'

import { MIGRATION_COMMIT_CUTOFF_MS, MIGRATION_LEASE_MS } from './lease'
import { ddbRowSchema, toPgRow } from './to-pg-row'

const DRAIN_MS = 15_000
const RECENT_ACCESS_MS = 30 * 60 * 1000
const MAX_COLUMNS = 1500
const DDB_PAGE_SIZE = 1000
// Postgres caps bind parameters at 65535 per statement.
const MAX_BIND_PARAMS = 60_000

export type MigrateTableResult = 'migrated' | 'skipped' | 'aborted' | 'failed'

export interface MigrateTableOptions {
  /** Returns true while the tiles-ddb-migration flag is 'migrate'. */
  isFlagOn: () => Promise<boolean>
  /** Lets writes that loaded TableMetadata just before the claim land first. */
  drain?: () => Promise<void>
}

class MigrationAbortedError extends Error {}

async function claimTable(tableId: string): Promise<Date | null> {
  const { rows } = await client.raw<{ rows: { migration_started_at: Date }[] }>(
    `
    UPDATE table_metadata
    SET migration_started_at = date_trunc('milliseconds', clock_timestamp())
    WHERE id = :tableId
      AND db = 'ddb'
      AND deleted_at IS NULL
      AND (config->>'ddbMigrationExcluded') IS DISTINCT FROM 'true'
      AND (
        migration_started_at IS NULL
        OR migration_started_at <= clock_timestamp() - :leaseMs * INTERVAL '1 millisecond'
      )
      AND NOT EXISTS (
        SELECT 1 FROM table_collaborators
        WHERE table_id = :tableId
          AND last_accessed_at > clock_timestamp() - :recentMs * INTERVAL '1 millisecond'
      )
    RETURNING migration_started_at
    `,
    { tableId, leaseMs: MIGRATION_LEASE_MS, recentMs: RECENT_ACCESS_MS },
  )
  return rows[0]?.migration_started_at ?? null
}

/** Never clears a claim that a replacement runner took after our lease expired. */
export async function clearClaim(
  tableId: string,
  claimedAt: Date,
): Promise<void> {
  await client.raw(
    `UPDATE table_metadata SET migration_started_at = NULL
     WHERE id = :tableId AND migration_started_at = :claimedAt`,
    { tableId, claimedAt },
  )
}

/**
 * Uses database time so a runner delayed after commit cannot flip an expired
 * claim. Clears its own claim when the flip is rejected.
 */
export async function flipTable(
  tableId: string,
  claimedAt: Date,
): Promise<boolean> {
  const { rowCount } = await client.raw<{ rowCount: number }>(
    `
    UPDATE table_metadata
    SET db = 'pg', migration_started_at = NULL,
        config = config || '{"migratedFromDdb": true}'
    WHERE id = :tableId
      AND db = 'ddb'
      AND migration_started_at = :claimedAt
      AND migration_started_at > clock_timestamp() - :cutoffMs * INTERVAL '1 millisecond'
      AND deleted_at IS NULL
    `,
    { tableId, claimedAt, cutoffMs: MIGRATION_COMMIT_CUTOFF_MS },
  )
  if (rowCount === 0) {
    await clearClaim(tableId, claimedAt)
    return false
  }
  return true
}

async function assertMayContinue(
  claimedAtMono: number,
  isFlagOn: () => Promise<boolean>,
): Promise<void> {
  if (!(await isFlagOn())) {
    throw new MigrationAbortedError('Flag is no longer migrate')
  }
  if (performance.now() - claimedAtMono >= MIGRATION_COMMIT_CUTOFF_MS) {
    throw new Error('Claim is past the commit cutoff')
  }
}

async function copyRows(
  trx: Knex.Transaction,
  tableId: string,
  columnIds: string[],
  claimedAtMono: number,
  isFlagOn: () => Promise<boolean>,
): Promise<{
  updatedAtByRowId: Map<string, number>
  strippedNullChars: number
}> {
  const chunkSize = Math.min(
    DDB_PAGE_SIZE,
    Math.floor(MAX_BIND_PARAMS / (columnIds.length + 3)),
  )
  const updatedAtByRowId = new Map<string, number>()
  let strippedNullChars = 0
  let prevCreatedAt: number | null = null
  let tieIndex = 0
  let cursor: string | null = null
  do {
    await assertMayContinue(claimedAtMono, isFlagOn)
    const page = await TableRow.query.byCreatedAt({ tableId }).go({
      order: 'asc',
      cursor,
      limit: DDB_PAGE_SIZE,
      ignoreOwnership: true,
    })
    const pgRows = page.data.map((raw) => {
      const item = ddbRowSchema.parse(raw)
      tieIndex = item.createdAt === prevCreatedAt ? tieIndex + 1 : 0
      prevCreatedAt = item.createdAt
      updatedAtByRowId.set(item.rowId, item.updatedAt)
      const mapped = toPgRow(item, columnIds, tieIndex)
      strippedNullChars += mapped.strippedNullChars
      return mapped.row
    })
    if (pgRows.length) {
      await trx.batchInsert(tableId, pgRows, chunkSize)
    }
    cursor = page.cursor
  } while (cursor)
  return { updatedAtByRowId, strippedNullChars }
}

/** Catches writes that landed in DynamoDB after the copy read their row. */
async function verifyRows(
  tableId: string,
  updatedAtByRowId: Map<string, number>,
): Promise<void> {
  let seen = 0
  let cursor: string | null = null
  do {
    const page = await TableRow.query.byRowId({ tableId }).go({
      cursor,
      limit: DDB_PAGE_SIZE,
      attributes: ['rowId', 'updatedAt'],
      ignoreOwnership: true,
    })
    for (const { rowId, updatedAt } of page.data) {
      if (updatedAtByRowId.get(rowId) !== updatedAt) {
        throw new Error(`Row ${rowId} changed during the copy`)
      }
    }
    seen += page.data.length
    cursor = page.cursor
  } while (cursor)
  if (seen !== updatedAtByRowId.size) {
    throw new Error('Row count changed during the copy')
  }
}

export async function migrateTable(
  tableId: string,
  { isFlagOn, drain = () => sleep(DRAIN_MS) }: MigrateTableOptions,
): Promise<MigrateTableResult> {
  const claimedAt = await claimTable(tableId)
  if (!claimedAt) {
    return 'skipped'
  }
  // A monotonic clock keeps the age checks correct if the wall clock jumps.
  const claimedAtMono = performance.now()

  let rowCount = 0
  let columnCount = 0
  let strippedNullChars = 0
  try {
    await drain()

    const columnIds = (
      await TableColumnMetadata.query()
        .select('id')
        .where({ table_id: tableId })
    ).map((column) => column.id)
    columnCount = columnIds.length
    if (columnCount > MAX_COLUMNS) {
      logger.warn('tiles-migration.table.skipped', {
        tableId,
        reason: 'too-many-columns',
        columnCount,
      })
      await clearClaim(tableId, claimedAt)
      return 'skipped'
    }

    await tilesClient.transaction(async (trx) => {
      await trx.raw(`SET LOCAL statement_timeout = '5min'`)
      // Drops an orphan from a runner that crashed between commit and flip.
      await trx.schema.dropTableIfExists(tableId)
      // Same shape as pg/table-functions createTable, which cannot join a transaction.
      await trx.schema.createTable(tableId, (table) => {
        table.string('rowId').primary()
        columnIds.forEach((columnId) => table.text(columnId))
        table.timestamps(true, true, true)
      })

      const copied = await copyRows(
        trx,
        tableId,
        columnIds,
        claimedAtMono,
        isFlagOn,
      )
      rowCount = copied.updatedAtByRowId.size
      strippedNullChars = copied.strippedNullChars

      await trx.schema.alterTable(tableId, (table) => {
        table.index(['createdAt', 'rowId'])
      })
      await verifyRows(tableId, copied.updatedAtByRowId)
      await assertMayContinue(claimedAtMono, isFlagOn)
    })
  } catch (err) {
    await clearClaim(tableId, claimedAt)
    const aborted = err instanceof MigrationAbortedError
    logger[aborted ? 'info' : 'error'](
      aborted
        ? 'tiles-migration.table.aborted'
        : 'tiles-migration.table.failed',
      { tableId, err: (err as Error).message },
    )
    return aborted ? 'aborted' : 'failed'
  }

  const freezeMs = Math.round(performance.now() - claimedAtMono)
  if (!(await flipTable(tableId, claimedAt))) {
    logger.error('tiles-migration.table.flip-rejected', { tableId, freezeMs })
    return 'failed'
  }
  logger.info('tiles-migration.table.migrated', {
    tableId,
    rowCount,
    columnCount,
    freezeMs,
    strippedNullChars,
  })
  return 'migrated'
}
