import { z } from 'zod'

import { archivalDbReader } from './db'

export type Tid = { page: number; offset: number }

// Postgres 14 added TID range scans. Older servers answer each ctid window with a full table scan.
const MIN_SERVER_VERSION_NUM = 140000

const ServerVersionRowSchema = z.object({
  version: z.coerce.number().int(),
})

const HeapPagesRowSchema = z.object({
  pages: z.coerce.number().int().nonnegative(),
})

const TID_PATTERN = /^\((\d+),(\d+)\)$/

export async function assertTidRangeScanSupported(): Promise<void> {
  const { rows } = await archivalDbReader.raw<{ rows: unknown[] }>(
    `SELECT current_setting('server_version_num') AS version`,
  )
  const { version } = ServerVersionRowSchema.parse(rows[0])
  if (version < MIN_SERVER_VERSION_NUM) {
    throw new Error(
      `archival needs Postgres 14+ for TID range scans, reader reports server_version_num ${version}`,
    )
  }
}

export async function getExecutionsHeapPages(): Promise<number> {
  const { rows } = await archivalDbReader.raw<{ rows: unknown[] }>(
    `SELECT pg_relation_size('executions') / current_setting('block_size')::int AS pages`,
  )
  return HeapPagesRowSchema.parse(rows[0]).pages
}

export function parseTid(text: string): Tid {
  const match = TID_PATTERN.exec(text)
  if (!match) {
    throw new Error(`invalid ctid: ${text}`)
  }
  return { page: Number(match[1]), offset: Number(match[2]) }
}

export function formatTid({ page, offset }: Tid): string {
  return `(${page},${offset})`
}
