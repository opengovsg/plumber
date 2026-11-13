import { readdir } from 'node:fs/promises'
import path from 'node:path'

import { ListObjectsV2Command, type S3Client } from '@aws-sdk/client-s3'
import type { Knex } from 'knex'

import logger from '@/helpers/archival/logger'

import type { SilverSink } from './export-silver-tables'
import { type SgtDayWindow, sgtDaysAfter, sgtDayWindow } from './sgt-day'
import {
  buildSilverDayKey,
  encodeSilverTable,
  parseSilverDayKey,
  SILVER_PREFIX,
  type SilverRow,
  type SilverTable,
} from './silver-table'

/**
 * A table written as one file per Singapore day, holding only the rows that changed that day.
 *
 * PostHog bills every row it imports, so a full copy each night would bill the whole table daily.
 */
export interface SilverChangeTable<Row extends SilverRow> {
  name: string
  columns: SilverTable<Row>['columns']
  // A null window asks for every row, for the first file or a re-baseline.
  // Each page becomes one file, so memory stays bounded however large the table grows.
  fetchPages: (db: Knex, window: SgtDayWindow | null) => AsyncIterable<Row[]>
}

export type SilverKeyLister = (prefix: string) => Promise<string[]>

export function s3KeyLister(
  s3Client: S3Client,
  bucket: string,
): SilverKeyLister {
  return async (prefix) => {
    const keys: string[] = []
    let token: string | undefined
    do {
      const page = await s3Client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          ContinuationToken: token,
        }),
      )
      keys.push(
        ...(page.Contents ?? []).flatMap(({ Key }): string[] =>
          Key ? [Key] : [],
        ),
      )
      token = page.NextContinuationToken
    } while (token)
    return keys
  }
}

export function localDirKeyLister(dir: string): SilverKeyLister {
  return async (prefix) => {
    try {
      const names = await readdir(path.join(dir, prefix))
      return names.map((name) => `${prefix}${name}`)
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return []
      }
      throw err
    }
  }
}

export interface ChangeFilePlan {
  day: string
  full: boolean
}

/**
 * Picks the day files to write, using the files already written as the watermark.
 *
 * A missed night is filled on the next run. With no file yet, a full copy becomes the first file.
 */
export function planChangeFiles(
  existingKeys: string[],
  yesterday: string,
  full: boolean,
): ChangeFilePlan[] {
  const lastDay = existingKeys
    .map(parseSilverDayKey)
    .filter((day): day is string => day !== null)
    .sort()
    .at(-1)
  if (full || !lastDay) {
    return [{ day: yesterday, full: true }]
  }
  return sgtDaysAfter(lastDay, yesterday).map((day) => ({ day, full: false }))
}

async function writeChangeFile({
  sink,
  table,
  day,
  part,
  rows,
  full,
}: {
  sink: SilverSink
  table: SilverChangeTable<SilverRow>
  day: string
  part?: number
  rows: SilverRow[]
  full: boolean
}): Promise<void> {
  // A full copy after a direct write repeats older rows' updated_at, so a view picks each row's latest by day first.
  const body = encodeSilverTable(
    { columns: { day: 'STRING', ...table.columns } },
    rows.map((row) => ({ day, ...row })),
  )
  const key = buildSilverDayKey(table.name, day, part)
  await sink(key, body)
  logger.info({
    event: 'analytics.export.change_file.written',
    table: table.name,
    key,
    full,
    rows: rows.length,
    bytes: body.length,
  })
}

interface WriteSilverChangeTablesParams {
  db: Knex
  sink: SilverSink
  listKeys: SilverKeyLister
  tables: SilverChangeTable<SilverRow>[]
  yesterday: string
  full?: boolean
}

export async function writeSilverChangeTables({
  db,
  sink,
  listKeys,
  tables,
  yesterday,
  full = false,
}: WriteSilverChangeTablesParams): Promise<void> {
  for (const table of tables) {
    const existingKeys = await listKeys(`${SILVER_PREFIX}${table.name}/`)
    for (const file of planChangeFiles(existingKeys, yesterday, full)) {
      const window = file.full ? null : sgtDayWindow(file.day)
      const write = (rows: SilverRow[], part?: number) =>
        writeChangeFile({
          sink,
          table,
          day: file.day,
          part,
          rows,
          full: file.full,
        })
      // IMPORTANT: the last page goes to the unnumbered key, written last. A run that fails
      // part-way leaves the day unmarked, so the next run writes it again instead of skipping it.
      let held: SilverRow[] = []
      let part = 0
      for await (const rows of table.fetchPages(db, window)) {
        if (part > 0) {
          await write(held, part)
        }
        held = rows
        part++
      }
      await write(held)
    }
  }
}
