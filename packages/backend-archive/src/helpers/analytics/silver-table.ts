import { parquetWriteBuffer } from 'hyparquet-writer'
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

export function buildSilverKey(tableName: string): string {
  return `${SILVER_PREFIX}${tableName}/current.parquet`
}

export function encodeSilverTable<Row extends SilverRow>(
  table: SilverTable<Row>,
  rows: Row[],
): Buffer {
  const columnData = Object.entries(table.columns).map(([name, type]) => ({
    name,
    type,
    data: rows.map((row) => row[name]),
  }))
  return Buffer.from(parquetWriteBuffer({ columnData }))
}
