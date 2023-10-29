import { ITableRow } from '@plumber/types'

export interface GenericRowData extends Record<string, string> {
  rowId: string
}

export function flattenRows(rows: ITableRow[]): GenericRowData[] {
  return rows.map((row) => ({ ...row.data, rowId: row.rowId }))
}
