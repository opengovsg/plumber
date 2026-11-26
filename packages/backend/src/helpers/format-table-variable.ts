/**
 * Table Variable Formatting Utility
 *
 * Converts table data from execution steps into HTML format
 * for use in transactional emails.
 */

import {
  MAX_TABLE_VARIABLE_CELLS_PER_STEP,
  MAX_TABLE_VARIABLE_COLUMNS,
  MAX_TABLE_VARIABLE_ROWS,
} from '@plumber/shared'

import { safeHtml } from './html-utils'
import logger from './logger'

// Logs instead of failing, because real cell value sizes are unknown.
const LARGE_OUTPUT_BYTES = 10 * 1024 * 1024

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

export interface TableCellBudget {
  remaining: number
}

export interface FormatTableOptions {
  selectedColumnIds: string[]
  cellBudget?: TableCellBudget
}

export type FormatTableResult =
  | {
      success: true
      output: string
    }
  | {
      success: false
      error:
        | 'invalid_columns'
        | 'no_columns'
        | 'invalid_structure'
        | 'limit_exceeded'
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
 *
 * NOTE: the frontend email preview mirrors this exact markup in
 * `buildTableHtml` (packages/frontend/src/components/RichTextEditor/utils.ts).
 * If you change the markup/styles here, update that mirror and its
 * markup-pinning test so the preview keeps matching the sent email.
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

interface PreparedTable {
  rows: TableRow[]
  columnMap: Map<string, TableColumn>
  outputs: Map<string, string>
}

// Reused when one body references the same table many times.
const preparedTables = new WeakMap<object, PreparedTable | null>()

function prepareTable(tableData: unknown): PreparedTable | null {
  if (typeof tableData !== 'object' || tableData === null) {
    return null
  }
  if (!preparedTables.has(tableData)) {
    preparedTables.set(
      tableData,
      validateTableData(tableData)
        ? {
            rows: tableData.rows,
            columnMap: new Map(tableData.columns.map((col) => [col.id, col])),
            outputs: new Map(),
          }
        : null,
    )
  }
  return preparedTables.get(tableData) ?? null
}

/**
 * Main function to format table data into HTML
 */
export function formatTable(
  tableData: unknown,
  options: FormatTableOptions,
): FormatTableResult {
  const selectedColumnIds = [...new Set(options.selectedColumnIds)]

  // IMPORTANT: check before any per-row work, since cost is rows × columns.
  if (selectedColumnIds.length > MAX_TABLE_VARIABLE_COLUMNS) {
    return {
      success: false,
      error: 'limit_exceeded',
      message: `Selected ${selectedColumnIds.length} columns, the limit is ${MAX_TABLE_VARIABLE_COLUMNS}`,
    }
  }
  const sourceRows = (tableData as { rows?: unknown } | null)?.rows
  if (
    Array.isArray(sourceRows) &&
    sourceRows.length > MAX_TABLE_VARIABLE_ROWS
  ) {
    return {
      success: false,
      error: 'limit_exceeded',
      message: `Table has ${sourceRows.length} rows, the limit is ${MAX_TABLE_VARIABLE_ROWS}`,
    }
  }

  const prepared = prepareTable(tableData)
  if (!prepared) {
    return {
      success: false,
      error: 'invalid_structure',
      message:
        'Invalid table data structure. Expected { rows: Array, columns: Array }',
    }
  }

  const { rows, columnMap, outputs } = prepared
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

  const { cellBudget } = options
  // The header row renders even when the table has no rows.
  const cellCount = (rows.length + 1) * columnsToUse.length
  if (cellBudget) {
    if (cellCount > cellBudget.remaining) {
      return {
        success: false,
        error: 'limit_exceeded',
        message: `Tables in this step exceed ${MAX_TABLE_VARIABLE_CELLS_PER_STEP} cells`,
      }
    }
    cellBudget.remaining -= cellCount
  }

  // Repeats reuse one string, so large cell values are not copied per reference.
  const outputKey = selectedColumnIds.join(',')
  let output = outputs.get(outputKey)
  if (output === undefined) {
    output = formatAsHtml(rows, columnsToUse)
    outputs.set(outputKey, output)
    const outputBytes = Buffer.byteLength(output)
    if (outputBytes > LARGE_OUTPUT_BYTES) {
      logger.warn('Table variable rendered a large output', {
        event: 'table-variable-large-output',
        outputBytes,
        rowCount: rows.length,
        columnCount: columnsToUse.length,
      })
    }
  }

  return {
    success: true,
    output,
  }
}
