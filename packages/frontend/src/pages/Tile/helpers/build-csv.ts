import type { ITableColumnMetadata } from '@plumber/types'

import { unparse } from 'papaparse'

import type { GenericRowData } from '../types'

/**
 * Builds a CSV string from table data. Returns null if there are no columns —
 * the caller should skip writing a file in that case.
 *
 * - With rows: produces header + data rows, mapping column IDs to column names.
 * - Without rows: produces a header-only CSV so the user gets a usable template.
 *
 * Values containing commas, quotes, or newlines are escaped per RFC 4180
 * (delegated to papaparse).
 */
export function buildCsv(
  rows: GenericRowData[],
  columns: ITableColumnMetadata[],
): string | null {
  if (columns.length === 0) {
    return null
  }

  const columnNames = columns.map((c) => c.name)

  if (rows.length === 0) {
    return unparse({ fields: columnNames, data: [] })
  }

  const columnIdToNameMap: Record<string, string> = {}
  columns.forEach((c) => {
    columnIdToNameMap[c.id] = c.name
  })

  const mappedData = rows.map((dataRow) => {
    const row: Record<string, string> = {}
    Object.entries(dataRow).forEach(([key, value]) => {
      // Skip keys without a matching column (e.g. rowId) so they don't
      // appear under an `undefined` column header.
      if (columnIdToNameMap[key] !== undefined) {
        row[columnIdToNameMap[key]] = value
      }
    })
    return row
  })

  return unparse(mappedData, { columns: columnNames })
}
