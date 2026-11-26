/**
 * Business rules:
 * - Table variables are capped at 100 columns and 500 rows. Over a cap, the
 *   table fails to render instead of exhausting memory.
 * - Large output: "log first, don't block the execution".
 */
import {
  MAX_TABLE_VARIABLE_COLUMNS,
  MAX_TABLE_VARIABLE_ROWS,
} from '@plumber/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { formatTable } from '../format-table-variable'
import logger from '../logger'

vi.mock('../logger', () => ({ default: { warn: vi.fn() } }))

function makeTable(rowCount: number, columnCount: number) {
  const columns = Array.from({ length: columnCount }, (_, i) => ({
    id: `c${i}`,
    name: `Col ${i}`,
  }))
  const rows = Array.from({ length: rowCount }, () => ({
    data: Object.fromEntries(columns.map((c) => [c.id, 'x'])),
  }))
  return { rows, columns }
}

describe('formatTable limits', () => {
  beforeEach(() => {
    vi.mocked(logger.warn).mockClear()
  })

  it('caps the limits at 100 columns and 500 rows', () => {
    expect(MAX_TABLE_VARIABLE_COLUMNS).toBe(100)
    expect(MAX_TABLE_VARIABLE_ROWS).toBe(500)
  })

  it('renders a table at the row and column limits', () => {
    const table = makeTable(MAX_TABLE_VARIABLE_ROWS, MAX_TABLE_VARIABLE_COLUMNS)
    const result = formatTable(table, {
      selectedColumnIds: table.columns.map((c) => c.id),
    })
    expect(result.success).toBe(true)
  })

  it('rejects one id repeated many times against thousands of rows', () => {
    expect(
      formatTable(makeTable(5000, 1), {
        selectedColumnIds: Array(100_000).fill('c0'),
      }),
    ).toMatchObject({ success: false, error: 'limit_exceeded' })
  })

  it('rejects too many distinct columns', () => {
    const table = makeTable(1, MAX_TABLE_VARIABLE_COLUMNS + 1)
    expect(
      formatTable(table, {
        selectedColumnIds: table.columns.map((c) => c.id),
      }),
    ).toMatchObject({ success: false, error: 'limit_exceeded' })
  })

  it('rejects too many rows', () => {
    expect(
      formatTable(makeTable(MAX_TABLE_VARIABLE_ROWS + 1, 1), {
        selectedColumnIds: ['c0'],
      }),
    ).toMatchObject({ success: false, error: 'limit_exceeded' })
  })

  it('logs but still renders a large output', () => {
    const result = formatTable(
      {
        rows: [{ data: { c0: 'x'.repeat(11 * 1024 * 1024) } }],
        columns: [{ id: 'c0', name: 'Big' }],
      },
      { selectedColumnIds: ['c0'] },
    )
    expect(result.success).toBe(true)
    expect(logger.warn).toHaveBeenCalledWith(
      'Table variable rendered a large output',
      expect.objectContaining({ event: 'table-variable-large-output' }),
    )
  })
})
