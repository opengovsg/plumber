import {
  MAX_TABLE_VARIABLE_COLUMNS,
  MAX_TABLE_VARIABLE_ROWS,
} from '@plumber/shared'
import escapeHtml from 'escape-html'

import { hexDecode } from '@/helpers/hex-encoding'

import type { VariableInfoMap } from './utils'

export interface TableRenderBudget {
  bytes: number
}

// The backend fails the step for these tables, so the preview says why.
const TABLE_OVER_LIMIT_NOTICE =
  "This table is over the size limit, so this email won't send."

export const HEX_MODIFIER_PATTERN = '[a-fA-F0-9]+'

// Matches a trailing `|<hexModifier>` suffix, capturing the hex in group 1.
// Reused for both `.match` (read the modifier) and `.replace` (strip it).
export const HEX_MODIFIER_SUFFIX_REGEX = new RegExp(
  `\\|(${HEX_MODIFIER_PATTERN})$`,
)

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
 * Builds an email-safe HTML table string from the resolved table data. Cell
 * content is escaped to prevent HTML injection.
 *
 * The markup/styles mirror the backend's email table renderer (formatAsHtml in
 * packages/backend/src/helpers/format-table-variable.ts) so the preview matches
 * the table that actually gets sent — keep the two in sync.
 */
function buildTableHtml(
  columns: Array<{ id: string; name: string }>,
  rows: Array<Record<string, unknown>>,
  maxBytes: number,
): { html: string; bytes: number } | null {
  const headerBg = '#F3F4F6' // gray.100
  const rowOddBg = '#FFFFFF' // white
  const rowEvenBg = '#F9FAFB' // gray.50
  const cell = 'border: 1px solid black; padding: 5px 10px; min-width: 100px;'

  // IMPORTANT: stops as soon as the output passes maxBytes, like the backend,
  // so an oversized table never builds in full.
  const parts: string[] = []
  let bytes = 0
  const append = (html: string): boolean => {
    bytes += sentByteLength(html)
    parts.push(html)
    return bytes <= maxBytes
  }

  if (!append('<table style="border-collapse: collapse;"><tbody><tr>')) {
    return null
  }
  for (const col of columns) {
    if (
      !append(
        `<td style="${cell} background-color: ${headerBg}; font-weight: 600;"><p style="margin: 0;">${escapeHtml(
          col.name,
        )}</p></td>`,
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
          `<td style="${cell} background-color: ${bg};"><p style="margin: 0;">${escapeHtml(
            cellToString(row[col.id]),
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

// UTF-8 length without allocating an encoded copy. Postman turns each newline
// into <br> before sending, adding 3 bytes.
function sentByteLength(html: string): number {
  let bytes = 0
  for (let i = 0; i < html.length; i++) {
    const code = html.charCodeAt(i)
    if (code < 0x80) {
      bytes += code === 0x0a ? 4 : 1
    } else if (code < 0x800) {
      bytes += 2
    } else if (
      code >= 0xd800 &&
      code <= 0xdbff &&
      (html.charCodeAt(i + 1) & 0xfc00) === 0xdc00
    ) {
      // A surrogate pair encodes one 4-byte character.
      bytes += 4
      i++
    } else {
      bytes += 3
    }
  }
  return bytes
}

/**
 * Renders a table-variable node's `data-id` (e.g. `step.uuid.path|hexModifier`)
 * into an HTML table string, or returns null when it can't be rendered (no table
 * data in varInfo, malformed modifier, or no valid selected columns).
 */
export function renderTableVariableHtml(
  dataId: string,
  varInfo: VariableInfoMap,
  renderBudget: TableRenderBudget,
): string | null {
  const modifierMatch = dataId.match(HEX_MODIFIER_SUFFIX_REGEX)
  if (!modifierMatch) {
    return null
  }
  const basePath = dataId.replace(HEX_MODIFIER_SUFFIX_REGEX, '')
  const tableData = varInfo.get(`{{${basePath}}}`)?.table
  if (!tableData) {
    return null
  }

  let decodedModifier: string
  try {
    decodedModifier = hexDecode(modifierMatch[1])
  } catch {
    return null
  }
  if (!decodedModifier.startsWith('table:')) {
    return null
  }
  const selectedColumnIds = [
    ...new Set(
      decodedModifier.slice('table:'.length).split(',').filter(Boolean),
    ),
  ]
  if (
    selectedColumnIds.length > MAX_TABLE_VARIABLE_COLUMNS ||
    tableData.rows.length > MAX_TABLE_VARIABLE_ROWS ||
    renderBudget.bytes <= 0
  ) {
    renderBudget.bytes = 0
    return TABLE_OVER_LIMIT_NOTICE
  }

  const columnById = new Map(tableData.columns.map((col) => [col.id, col]))
  const selectedColumns = selectedColumnIds
    .map((id) => columnById.get(id))
    .filter((col): col is { id: string; name: string } => col != null)
  // The backend sends nothing when any selected column is missing.
  if (
    selectedColumns.length === 0 ||
    selectedColumns.length !== selectedColumnIds.length
  ) {
    return ''
  }

  const table = buildTableHtml(
    selectedColumns,
    tableData.rows,
    renderBudget.bytes,
  )
  if (!table) {
    renderBudget.bytes = 0
    return TABLE_OVER_LIMIT_NOTICE
  }
  renderBudget.bytes -= table.bytes
  return table.html
}
