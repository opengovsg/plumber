import { parquetWriteBuffer, type SchemaElement } from 'hyparquet-writer'
import type { Knex } from 'knex'

export type SilverColumnType = 'STRING' | 'TIMESTAMP' | 'INT64' | 'BOOLEAN'

export type SilverRow = Record<string, string | Date | number | boolean | null>

export interface SilverTable<Row extends SilverRow> {
  name: string
  // Explicit types keep the schema stable when a column is all null.
  columns: { [K in keyof Row & string]: SilverColumnType }
  fetchRows: (db: Knex) => Promise<Row[]>
}

export const SILVER_PREFIX = 'silver/'

const COLUMN_SCHEMA: Record<SilverColumnType, Omit<SchemaElement, 'name'>> = {
  STRING: { type: 'BYTE_ARRAY', converted_type: 'UTF8' },
  // The UTC flag makes every engine read an instant. DuckDB reads a bare TIMESTAMP_MILLIS as local time.
  TIMESTAMP: {
    type: 'INT64',
    converted_type: 'TIMESTAMP_MILLIS',
    logical_type: { type: 'TIMESTAMP', isAdjustedToUTC: true, unit: 'MILLIS' },
  },
  INT64: { type: 'INT64' },
  BOOLEAN: { type: 'BOOLEAN' },
}

export function buildSilverKey(tableName: string): string {
  return `${SILVER_PREFIX}${tableName}/current.parquet`
}

// Flat under the table folder, because the PostHog source pattern silver/*/*.parquet matches one level.
// A day too large for one file continues in part-2, part-3 and so on.
export function buildSilverDayKey(
  tableName: string,
  day: string,
  part = 1,
): string {
  const suffix = part > 1 ? `.part-${part}` : ''
  return `${SILVER_PREFIX}${tableName}/day=${day}${suffix}.parquet`
}

const DAY_KEY = /\/day=(\d{4}-\d{2}-\d{2})(?:\.part-\d+)?\.parquet$/

export function parseSilverDayKey(key: string): string | null {
  return DAY_KEY.exec(key)?.[1] ?? null
}

function toParquetValue(
  type: SilverColumnType,
  value: SilverRow[string],
): SilverRow[string] | bigint {
  if (type === 'INT64' && typeof value === 'number') {
    return BigInt(value)
  }
  return value
}

export function encodeSilverTable<Row extends SilverRow>(
  table: Pick<SilverTable<Row>, 'columns'>,
  rows: Row[],
): Buffer {
  const columns = Object.entries(table.columns) as [string, SilverColumnType][]
  const schema: SchemaElement[] = [
    { name: 'root', num_children: columns.length },
    ...columns.map(([name, type]) => ({
      name,
      repetition_type: 'OPTIONAL' as const,
      ...COLUMN_SCHEMA[type],
    })),
  ]
  const columnData = columns.map(([name, type]) => ({
    name,
    data: rows.map((row) => toParquetValue(type, row[name])),
  }))
  return Buffer.from(parquetWriteBuffer({ columnData, schema }))
}
