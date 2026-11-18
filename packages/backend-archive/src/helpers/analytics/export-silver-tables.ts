import type { S3Client } from '@aws-sdk/client-s3'
import type { Knex } from 'knex'

import logger from '@/helpers/archival/logger'
import { putArchiveObject } from '@/helpers/archival/s3-client'

import {
  buildSilverKey,
  encodeSilverTable,
  type SilverRow,
  type SilverTable,
} from './silver-table'
import { flowTransferTable } from './tables/flow-transfer'

export const SILVER_TABLES: SilverTable<SilverRow>[] = [flowTransferTable]

// IMPORTANT: every environment shares one PostHog project, but each has its own
// bucket. PostHog reads a bucket only if someone attaches it. UAT and local stay off.
export const EXPORT_APP_ENVS: ReadonlySet<string> = new Set(['prod', 'staging'])

interface ExportSilverTablesParams {
  db: Knex
  s3Client: S3Client
  appEnv: string
  bucket: string | undefined
  tables?: SilverTable<SilverRow>[]
}

export async function exportSilverTables({
  db,
  s3Client,
  appEnv,
  bucket,
  tables = SILVER_TABLES,
}: ExportSilverTablesParams): Promise<void> {
  if (!EXPORT_APP_ENVS.has(appEnv)) {
    logger.info({ event: 'analytics.export.skipped', appEnv })
    return
  }
  if (!bucket) {
    throw new Error(`ANALYTICS_BUCKET must be set in ${appEnv}`)
  }

  for (const table of tables) {
    const rows = await table.fetchRows(db)
    const body = encodeSilverTable(table, rows)
    const key = buildSilverKey(table.name)
    await putArchiveObject({
      s3Client,
      bucket,
      key,
      body,
      contentType: 'application/vnd.apache.parquet',
    })
    logger.info({
      event: 'analytics.export.table.written',
      table: table.name,
      key,
      rows: rows.length,
      bytes: body.length,
    })
  }
}
