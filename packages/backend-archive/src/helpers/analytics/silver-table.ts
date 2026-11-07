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
  table: SilverTable<Row>,
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
