import type TableMetadata from '@/models/table-metadata'

export const MIGRATION_LEASE_MS = 30 * 60 * 1000
export const MIGRATION_COMMIT_CUTOFF_MS = 25 * 60 * 1000

/**
 * A claim older than the lease counts as not frozen, so a crashed runner
 * cannot freeze a tile for longer than the lease.
 */
export function isTileMigrating(
  table: Pick<TableMetadata, 'db' | 'migrationStartedAt'>,
): boolean {
  if (table.db !== 'ddb' || !table.migrationStartedAt) {
    return false
  }
  return (
    Date.now() - new Date(table.migrationStartedAt).getTime() <
    MIGRATION_LEASE_MS
  )
}
