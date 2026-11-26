/**
 * Business rules:
 * - Table variables are capped at 100 columns and 500 rows. All tables in one
 *   step share a 10 MB HTML budget. Over a cap, the step fails
 *   instead of exhausting memory or sending the email without the table.
 * - Large output: log at 5 MB, fail the step at 10 MB.
 */
import {
  MAX_TABLE_VARIABLE_BYTES_PER_STEP,
  MAX_TABLE_VARIABLE_COLUMNS,
  MAX_TABLE_VARIABLE_ROWS,
} from '@plumber/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createTableRenderBudget, formatTable } from '../format-table-variable'
import logger from '../logger'

vi.mock('../logger', () => ({ default: { warn: vi.fn() } }))

const MB = 1024 * 1024

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

function makeBigCellTable(cellBytes: number) {
  return {
    rows: [{ data: { big: 'x'.repeat(cellBytes), a: 'a', b: 'b' } }],
    columns: [
      { id: 'big', name: 'Big' },
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ],
  }
}

describe('formatTable limits', () => {
  beforeEach(() => {
    vi.mocked(logger.warn).mockClear()
  })

  it('caps tables at 100 columns, 500 rows and 10 MB per step', () => {
    expect(MAX_TABLE_VARIABLE_COLUMNS).toBe(100)
    expect(MAX_TABLE_VARIABLE_ROWS).toBe(500)
    expect(MAX_TABLE_VARIABLE_BYTES_PER_STEP).toBe(10 * MB)
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

  it('charges the step byte budget for every reference to a table', () => {
    const table = makeBigCellTable(4 * MB)
    const options = {
      selectedColumnIds: ['big'],
      renderBudget: createTableRenderBudget(),
    }
    expect(formatTable(table, options).success).toBe(true)
    expect(formatTable(table, options).success).toBe(true)
    expect(formatTable(table, options)).toMatchObject({
      success: false,
      error: 'limit_exceeded',
    })
  })

  it('stops overlapping selections of a large cell at the byte budget', () => {
    const table = makeBigCellTable(4 * MB)
    const renderBudget = createTableRenderBudget()
    const results = [
      ['big', 'a'],
      ['big', 'b'],
      ['a', 'big'],
    ].map(
      (selectedColumnIds) =>
        formatTable(table, { selectedColumnIds, renderBudget }).success,
    )
    expect(results).toEqual([true, true, false])
    // Once exhausted, later tables are rejected before any rendering.
    expect(renderBudget.bytes).toBeLessThan(4 * MB)
  })

  it('rejects a single table over the byte budget', () => {
    expect(
      formatTable(makeBigCellTable(11 * MB), { selectedColumnIds: ['big'] }),
    ).toMatchObject({ success: false, error: 'limit_exceeded' })
  })

  it('logs once when a step renders over 5 MB', () => {
    const table = makeBigCellTable(3 * MB)
    const renderBudget = createTableRenderBudget()
    for (const selectedColumnIds of [['big'], ['big', 'a'], ['big', 'b']]) {
      formatTable(table, { selectedColumnIds, renderBudget })
    }
    expect(logger.warn).toHaveBeenCalledTimes(1)
    expect(logger.warn).toHaveBeenCalledWith(
      'Table variables rendered a large output',
      expect.objectContaining({ event: 'table-variable-large-output' }),
    )
  })
})
