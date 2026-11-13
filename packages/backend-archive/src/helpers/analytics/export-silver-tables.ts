import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

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
import { actionCatalogTable } from './tables/action-catalog'
import { dimUserTable } from './tables/dim-user'
import { flowAccessTable } from './tables/flow-access'
import { flowAiSuggestionTable } from './tables/flow-ai-suggestion'
import { flowStageTable } from './tables/flow-stage'
import { flowTransferTable } from './tables/flow-transfer'

export const SILVER_TABLES: SilverTable<SilverRow>[] = [
  flowTransferTable,
  dimUserTable,
  flowStageTable,
  flowAccessTable,
  flowAiSuggestionTable,
  actionCatalogTable,
]

// IMPORTANT: every environment shares one PostHog project, but each has its own
// bucket. PostHog reads a bucket only if someone attaches it. UAT and local stay off.
export const EXPORT_APP_ENVS: ReadonlySet<string> = new Set(['prod', 'staging'])

export type SilverSink = (key: string, body: Buffer) => Promise<void>

export function s3Sink(s3Client: S3Client, bucket: string): SilverSink {
  return (key, body) =>
    putArchiveObject({
      s3Client,
      bucket,
      key,
      body,
      contentType: 'application/vnd.apache.parquet',
    })
}

export function localDirSink(dir: string): SilverSink {
  return async (key, body) => {
    const filePath = path.join(dir, key)
    await mkdir(path.dirname(filePath), { recursive: true })
    await writeFile(filePath, body)
  }
}

export function selectSilverTables(names: string[]): SilverTable<SilverRow>[] {
  const unknown = names.filter(
    (name) => !SILVER_TABLES.some((table) => table.name === name),
  )
  if (unknown.length > 0) {
    throw new Error(`Unknown silver tables: ${unknown.join(', ')}`)
  }
  return SILVER_TABLES.filter((table) => names.includes(table.name))
}

interface WriteSilverTablesParams {
  db: Knex
  sink: SilverSink
  tables?: SilverTable<SilverRow>[]
}

export async function writeSilverTables({
  db,
  sink,
  tables = SILVER_TABLES,
}: WriteSilverTablesParams): Promise<void> {
  for (const table of tables) {
    const rows = await table.fetchRows(db)
    const body = encodeSilverTable(table, rows)
    const key = buildSilverKey(table.name)
    await sink(key, body)
    logger.info({
      event: 'analytics.export.table.written',
      table: table.name,
      key,
      rows: rows.length,
      bytes: body.length,
    })
  }
}

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
  await writeSilverTables({ db, tables, sink: s3Sink(s3Client, bucket) })
}
