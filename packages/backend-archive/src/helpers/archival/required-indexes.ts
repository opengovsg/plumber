import { z } from 'zod'

import { archivalDbReader } from './db'

// Without either index, every batch scans and sorts all of executions.
const REQUIRED_INDEXES = [
  'executions_created_at_id_index',
  'flows_test_execution_id_index',
]

const IndexRowSchema = z.object({ name: z.string(), usable: z.boolean() })

// IMPORTANT: migrations run by hand, and a concurrent build can be unfinished or invalid.
export async function assertRequiredIndexes(): Promise<void> {
  const { rows } = await archivalDbReader.raw<{ rows: unknown[] }>(
    `SELECT c.relname AS name, i.indisvalid AND i.indisready AS usable
     FROM pg_index i
     JOIN pg_class c ON c.oid = i.indexrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relname = ANY(?) AND n.nspname = current_schema()`,
    [REQUIRED_INDEXES],
  )
  const usable = new Set(
    z
      .array(IndexRowSchema)
      .parse(rows)
      .filter((row) => row.usable)
      .map((row) => row.name),
  )
  const missing = REQUIRED_INDEXES.filter((name) => !usable.has(name))
  if (missing.length > 0) {
    throw new Error(
      `archival needs these indexes, valid and ready, on the reader: ${missing.join(', ')}`,
    )
  }
}
