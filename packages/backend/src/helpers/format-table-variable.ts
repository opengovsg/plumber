/**
 * Table Variable Formatting Utility
 *
 * Converts table data from execution steps into HTML format
 * for use in transactional emails.
 */

import { safeHtml } from './html-utils'

export interface TableColumn {
  id: string
  name: string
  value?: string
}

export interface TableRow {
  rowId?: string
  data: Record<string, unknown>
}

export interface TableData {
  rows: TableRow[]
  columns: TableColumn[]
  inputSource?: string
}

export interface FormatTableOptions {
  selectedColumnIds: string[]
}

export type FormatTableResult =
  | {
      success: true
      output: string
    }
  | {
      success: false
      error: 'invalid_columns' | 'no_columns' | 'invalid_structure'
      message: string
      invalidColumns?: string[]
    }

/**
 * Converts cell value to string, handling various types
 */
function cellToString(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}

/**
 * Formats table data as an HTML table with inline CSS for email compatibility
 * Simple black borders with background colors matching the preview
 */
function formatAsHtml(rows: TableRow[], columns: TableColumn[]): string {
  const headerBg = '#F3F4F6' // gray.100
  const rowOddBg = '#FFFFFF' // white
  const rowEvenBg = '#F9FAFB' // gray.50
  const cell = 'border: 1px solid black; padding: 5px 10px; min-width: 100px;'

  const headerCells = columns
    .map(
      (col) =>
        safeHtml`<td style="${cell} background-color: ${headerBg}; font-weight: 600;"><p style="margin: 0;">${col.name}</p></td>`,
    )
    .join('')

  const dataRows = rows
    .map((row, i) => {
      const bg = i % 2 === 0 ? rowOddBg : rowEvenBg
      const cells = columns
        .map(
          (col) =>
            safeHtml`<td style="${cell} background-color: ${bg};"><p style="margin: 0;">${cellToString(
              row.data[col.id],
            )}</p></td>`,
        )
        .join('')
      return `<tr>${cells}</tr>`
    })
    .join('')

  return `<table style="border-collapse: collapse;"><tbody><tr>${headerCells}</tr>${dataRows}</tbody></table>`
}

/**
 * Validates table data structure
 */
function validateTableData(tableData: unknown): tableData is TableData {
  if (!tableData || typeof tableData !== 'object') {
    return false
  }

  const data = tableData as Record<string, unknown>

  if (!Array.isArray(data.rows) || !Array.isArray(data.columns)) {
    return false
  }

  for (const col of data.columns) {
    if (
      typeof col !== 'object' ||
      col === null ||
      typeof (col as TableColumn).id !== 'string' ||
      typeof (col as TableColumn).name !== 'string'
    ) {
      return false
    }
  }

  for (const row of data.rows) {
    if (
      typeof row !== 'object' ||
      row === null ||
      typeof (row as TableRow).data !== 'object' ||
      (row as TableRow).data === null
    ) {
      return false
    }
  }

  return true
}

/**
 * Main function to format table data into HTML
 */
export function formatTable(
  tableData: unknown,
  options: FormatTableOptions,
): FormatTableResult {
  if (!validateTableData(tableData)) {
    return {
      success: false,
      error: 'invalid_structure',
      message:
        'Invalid table data structure. Expected { rows: Array, columns: Array }',
    }
  }

  const { rows, columns } = tableData
  const { selectedColumnIds } = options

  const columnMap = new Map(columns.map((col) => [col.id, col]))
  const columnsToUse: TableColumn[] = []
  const invalidColumns: string[] = []

  for (const colId of selectedColumnIds) {
    const col = columnMap.get(colId)
    if (col) {
      columnsToUse.push(col)
    } else {
      invalidColumns.push(colId)
    }
  }

  if (invalidColumns.length > 0) {
    return {
      success: false,
      error: 'invalid_columns',
      message: `Invalid column IDs: ${invalidColumns.join(', ')}`,
      invalidColumns,
    }
  }

  if (columnsToUse.length === 0) {
    return {
      success: false,
      error: 'no_columns',
      message: 'No columns to display',
    }
  }

  return {
    success: true,
    output: formatAsHtml(rows, columnsToUse),
  }
}
