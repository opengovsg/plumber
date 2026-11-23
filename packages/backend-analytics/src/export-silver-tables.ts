import { randomUUID } from 'node:crypto'
import { mkdir, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { PutObjectCommand, type S3Client } from '@aws-sdk/client-s3'
import type { Knex } from 'knex'

import { s3CompletionStore } from './completion-stores'
import type { CompletionSource, CompletionStore } from './day-completion'
import logger from './logger'
import { previousSgtDay } from './sgt-day'
import {
  type SilverChangeTable,
  writeSilverChangeTables,
} from './silver-change-tables'
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
import { flowStepTable } from './tables/flow-step'
import { flowTransferTable } from './tables/flow-transfer'
import { writeEachTable } from './write-each-table'

export const SILVER_TABLES: SilverTable<SilverRow>[] = [
  flowTransferTable,
  dimUserTable,
  flowStageTable,
  flowAccessTable,
  flowAiSuggestionTable,
  actionCatalogTable,
]

export const SILVER_CHANGE_TABLES: SilverChangeTable<SilverRow>[] = [
  flowStepTable,
]

// IMPORTANT: every environment shares one PostHog project, but each has its own
// bucket. PostHog reads a bucket only if someone attaches it. UAT and local stay off.
export const EXPORT_APP_ENVS: ReadonlySet<string> = new Set(['prod', 'staging'])

export type SilverSink = (key: string, body: Buffer) => Promise<void>

export function s3Sink(s3Client: S3Client, bucket: string): SilverSink {
  return async (key, body) => {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: key.endsWith('.json')
          ? 'application/json'
          : 'application/vnd.apache.parquet',
      }),
    )
  }
}

export function localDirSink(dir: string): SilverSink {
  return async (key, body) => {
    const filePath = path.join(dir, key)
    await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 })
    // A half-written file must never carry its final name. Mode 0600 because dim_user holds emails.
    const tempPath = `${filePath}.${randomUUID()}.tmp`
    await writeFile(tempPath, body, { mode: 0o600 })
    await rename(tempPath, filePath)
  }
}

export function selectSilverTables(names: string[]): {
  tables: SilverTable<SilverRow>[]
  changeTables: SilverChangeTable<SilverRow>[]
} {
  const known = [...SILVER_TABLES, ...SILVER_CHANGE_TABLES].map(
    (table) => table.name,
  )
  const unknown = names.filter((name) => !known.includes(name))
  if (unknown.length > 0) {
    throw new Error(`Unknown silver tables: ${unknown.join(', ')}`)
  }
  return {
    tables: SILVER_TABLES.filter((table) => names.includes(table.name)),
    changeTables: SILVER_CHANGE_TABLES.filter((table) =>
      names.includes(table.name),
    ),
  }
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
  await writeEachTable(tables, async (table) => {
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
  })
}

interface WriteAllSilverTablesParams extends WriteSilverTablesParams {
  store: CompletionStore
  changeTables?: SilverChangeTable<SilverRow>[]
  // Rewrites each change table as a full copy, after a direct database write.
  full?: boolean
  source?: CompletionSource
  now?: Date
}

export async function writeAllSilverTables({
  db,
  sink,
  store,
  tables = SILVER_TABLES,
  changeTables = SILVER_CHANGE_TABLES,
  full = false,
  source = 'nightly',
  now = new Date(),
}: WriteAllSilverTablesParams): Promise<void> {
  // A failed snapshot table must not hold back the change tables, whose catch-up window is short.
  const errors: Error[] = []
  await writeSilverTables({ db, sink, tables }).catch((err: Error) => {
    errors.push(err)
  })
  await writeSilverChangeTables({
    db,
    sink,
    store,
    tables: changeTables,
    yesterday: previousSgtDay(now),
    full,
    source,
  }).catch((err: Error) => {
    errors.push(err)
  })
  if (errors.length > 0) {
    throw new Error(errors.map((err) => err.message).join('. '))
  }
}

interface ExportSilverTablesParams extends Omit<
  WriteAllSilverTablesParams,
  'sink' | 'store'
> {
  s3Client: S3Client
  appEnv: string
  bucket: string | undefined
}

export async function exportSilverTables({
  s3Client,
  appEnv,
  bucket,
  ...params
}: ExportSilverTablesParams): Promise<void> {
  if (!EXPORT_APP_ENVS.has(appEnv)) {
    logger.info({ event: 'analytics.export.skipped', appEnv })
    return
  }
  if (!bucket) {
    throw new Error(`ANALYTICS_BUCKET must be set in ${appEnv}`)
  }
  await writeAllSilverTables({
    ...params,
    sink: s3Sink(s3Client, bucket),
    store: s3CompletionStore(s3Client, bucket),
  })
}
