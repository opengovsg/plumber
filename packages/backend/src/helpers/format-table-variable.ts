/**
 * Table Variable Formatting Utility
 *
 * Converts table data from execution steps into HTML format
 * for use in transactional emails.
 */

import {
  MAX_TABLE_VARIABLE_BYTES_PER_STEP,
  MAX_TABLE_VARIABLE_COLUMNS,
  MAX_TABLE_VARIABLE_ROWS,
} from '@plumber/shared'

import { safeHtml } from './html-utils'
import logger from './logger'

// Logs well before the byte limit, so near-misses show up first.
const LARGE_OUTPUT_BYTES = 5 * 1024 * 1024

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

interface RenderedTable {
  html: string
  bytes: number
}

interface PreparedTable {
  rows: TableRow[]
  columnMap: Map<string, TableColumn>
  outputs: Map<string, RenderedTable>
}

/** Shared by every table variable in one step. */
export interface TableRenderBudget {
  bytes: number
  hasLoggedLargeOutput: boolean
  // Reused when one body references the same table many times.
  preparedTables: Map<object, PreparedTable | null>
}

export function createTableRenderBudget(): TableRenderBudget {
  return {
    bytes: MAX_TABLE_VARIABLE_BYTES_PER_STEP,
    hasLoggedLargeOutput: false,
    preparedTables: new Map(),
  }
}

export interface FormatTableOptions {
  selectedColumnIds: string[]
  renderBudget?: TableRenderBudget
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
function formatAsHtml(
  rows: TableRow[],
  columns: TableColumn[],
  maxBytes: number,
): RenderedTable | null {
  const headerBg = '#F3F4F6' // gray.100
  const rowOddBg = '#FFFFFF' // white
  const rowEvenBg = '#F9FAFB' // gray.50
  const cell = 'border: 1px solid black; padding: 5px 10px; min-width: 100px;'

  // IMPORTANT: stops as soon as the output passes maxBytes, so an oversized
  // table costs at most one cell past the limit.
  const parts: string[] = []
  let bytes = 0
  const append = (fragment: string): boolean => {
    // Postman turns newlines into <br> later, so count them as sent.
    const html = fragment.replace(/\n/g, '<br>')
    bytes += Buffer.byteLength(html)
    parts.push(html)
    return bytes <= maxBytes
  }

  if (!append('<table style="border-collapse: collapse;"><tbody><tr>')) {
    return null
  }
  for (const col of columns) {
    if (
      !append(
        safeHtml`<td style="${cell} background-color: ${headerBg}; font-weight: 600;"><p style="margin: 0;">${col.name}</p></td>`,
      )
    ) {
      return null
    }
  }
  if (!append('</tr>')) {
    return null
  }

  for (const [i, row] of rows.entries()) {
    const bg = i % 2 === 0 ? rowOddBg : rowEvenBg
    if (!append('<tr>')) {
      return null
    }
    for (const col of columns) {
      if (
        !append(
          safeHtml`<td style="${cell} background-color: ${bg};"><p style="margin: 0;">${cellToString(
            row.data[col.id],
          )}</p></td>`,
        )
      ) {
        return null
      }
    }
    if (!append('</tr>')) {
      return null
    }
  }

  if (!append('</tbody></table>')) {
    return null
  }
  return { html: parts.join(''), bytes }
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

function prepareTable(
  tableData: unknown,
  preparedTables: TableRenderBudget['preparedTables'],
): PreparedTable | null {
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
  const budget = options.renderBudget ?? createTableRenderBudget()
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

  if (budget.bytes <= 0) {
    return {
      success: false,
      error: 'limit_exceeded',
      message: `Tables in this step exceed ${MAX_TABLE_VARIABLE_BYTES_PER_STEP} bytes`,
    }
  }

  const prepared = prepareTable(tableData, budget.preparedTables)
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

  // Repeats reuse one string, so large cell values are not copied per reference.
  const outputKey = JSON.stringify(selectedColumnIds)
  let output = outputs.get(outputKey)
  if (output === undefined) {
    output = formatAsHtml(rows, columnsToUse, budget.bytes) ?? undefined
    if (output) {
      outputs.set(outputKey, output)
    }
  }
  if (!output || output.bytes > budget.bytes) {
    return {
      success: false,
      error: 'limit_exceeded',
      message: `Tables in this step exceed ${MAX_TABLE_VARIABLE_BYTES_PER_STEP} bytes`,
    }
  }

  budget.bytes -= output.bytes
  const usedBytes = MAX_TABLE_VARIABLE_BYTES_PER_STEP - budget.bytes
  if (usedBytes > LARGE_OUTPUT_BYTES && !budget.hasLoggedLargeOutput) {
    budget.hasLoggedLargeOutput = true
    logger.warn('Table variables rendered a large output', {
      event: 'table-variable-large-output',
      outputBytes: usedBytes,
    })
  }

  return {
    success: true,
    output: output.html,
  }
}
