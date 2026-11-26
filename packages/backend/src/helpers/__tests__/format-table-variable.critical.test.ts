/**
 * Business rules:
 * - Table variables are capped at 100 columns and 500 rows, and all tables in
 *   one step share a 100,000-cell budget. Over a cap, the table fails to
 *   render instead of exhausting memory.
 * - Large output: "log first, don't block the execution".
 */
import {
  MAX_TABLE_VARIABLE_CELLS_PER_STEP,
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
    expect(MAX_TABLE_VARIABLE_CELLS_PER_STEP).toBe(100_000)
  })

  it('stops rendering tables once the step cell budget runs out', () => {
    // (400 rows + 1 header) × 100 columns = 40,100 cells per table.
    const table = makeTable(400, MAX_TABLE_VARIABLE_COLUMNS)
    const options = {
      selectedColumnIds: table.columns.map((c) => c.id),
      cellBudget: { remaining: MAX_TABLE_VARIABLE_CELLS_PER_STEP },
    }
    expect(formatTable(table, options).success).toBe(true)
    expect(formatTable(table, options).success).toBe(true)
    expect(formatTable(table, options)).toMatchObject({
      success: false,
      error: 'limit_exceeded',
    })
  })

  it('charges the header row of an empty table', () => {
    const table = makeTable(0, 1)
    const cellBudget = { remaining: 1 }
    expect(
      formatTable(table, { selectedColumnIds: ['c0'], cellBudget }).success,
    ).toBe(true)
    expect(cellBudget.remaining).toBe(0)
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

  it('renders a repeated large table once', () => {
    const table = {
      rows: [{ data: { c0: 'x'.repeat(11 * 1024 * 1024) } }],
      columns: [{ id: 'c0', name: 'Big' }],
    }
    const options = { selectedColumnIds: ['c0'] }
    expect(formatTable(table, options).success).toBe(true)
    expect(formatTable(table, options).success).toBe(true)
    expect(logger.warn).toHaveBeenCalledTimes(1)
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
