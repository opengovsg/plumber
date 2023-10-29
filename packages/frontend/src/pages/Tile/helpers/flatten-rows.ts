import { ITableRow } from '@plumber/types'

import { GenericRowData } from '../types'

export function flattenRows(rows: ITableRow[]): GenericRowData[] {
  return rows.map((row) => ({ ...row.data, rowId: row.rowId }))
}
