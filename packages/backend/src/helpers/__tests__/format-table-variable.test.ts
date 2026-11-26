import {
  MAX_TABLE_VARIABLE_COLUMNS,
  MAX_TABLE_VARIABLE_ROWS,
} from '@plumber/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { formatTable } from '../format-table-variable'
import logger from '../logger'

vi.mock('../logger', () => ({ default: { warn: vi.fn() } }))

const COLS = [
  { id: 'col1', name: 'Name' },
  { id: 'col2', name: 'Email' },
]

const ROWS = [
  { data: { col1: 'Alice', col2: 'alice@example.com' } },
  { data: { col1: 'Bob', col2: 'bob@example.com' } },
]

describe('formatTable', () => {
  describe('invalid structure', () => {
    it.each([null, undefined, 'string', 42, []])(
      'returns invalid_structure for %s',
      (input) => {
        expect(
          formatTable(input, { selectedColumnIds: ['col1'] }),
        ).toMatchObject({
          success: false,
          error: 'invalid_structure',
        })
      },
    )

    it('returns invalid_structure when rows is missing', () => {
      expect(
        formatTable({ columns: COLS }, { selectedColumnIds: ['col1'] }),
      ).toMatchObject({
        success: false,
        error: 'invalid_structure',
      })
    })

    it('returns invalid_structure when columns is missing', () => {
      expect(
        formatTable({ rows: ROWS }, { selectedColumnIds: ['col1'] }),
      ).toMatchObject({
        success: false,
        error: 'invalid_structure',
      })
    })

    it('returns invalid_structure when a column is missing id', () => {
      expect(
        formatTable(
          { rows: [], columns: [{ name: 'No ID' }] },
          { selectedColumnIds: ['col1'] },
        ),
      ).toMatchObject({ success: false, error: 'invalid_structure' })
    })

    it('returns invalid_structure when a column is missing name', () => {
      expect(
        formatTable(
          { rows: [], columns: [{ id: 'col1' }] },
          { selectedColumnIds: ['col1'] },
        ),
      ).toMatchObject({ success: false, error: 'invalid_structure' })
    })

    it('returns invalid_structure when a column is null', () => {
      expect(
        formatTable(
          { rows: [], columns: [null] },
          { selectedColumnIds: ['col1'] },
        ),
      ).toMatchObject({
        success: false,
        error: 'invalid_structure',
      })
    })
  })

  describe('column selection', () => {
    it('returns no_columns when selectedColumnIds is an empty array', () => {
      expect(
        formatTable({ rows: [], columns: COLS }, { selectedColumnIds: [] }),
      ).toMatchObject({ success: false, error: 'no_columns' })
    })

    it('renders only selected columns', () => {
      const result = formatTable(
        { rows: ROWS, columns: COLS },
        { selectedColumnIds: ['col1'] },
      )
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.output).toContain('Name')
        expect(result.output).not.toContain('Email')
      }
    })

    it('renders selected columns in the specified order', () => {
      const result = formatTable(
        { rows: ROWS, columns: COLS },
        { selectedColumnIds: ['col2', 'col1'] },
      )
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.output.indexOf('Email')).toBeLessThan(
          result.output.indexOf('Name'),
        )
      }
    })

    it('returns invalid_columns when a selected column does not exist', () => {
      expect(
        formatTable(
          { rows: ROWS, columns: COLS },
          { selectedColumnIds: ['col1', 'nonexistent'] },
        ),
      ).toMatchObject({
        success: false,
        error: 'invalid_columns',
        invalidColumns: ['nonexistent'],
      })
    })

    it('collects all invalid column ids in the error', () => {
      expect(
        formatTable(
          { rows: ROWS, columns: COLS },
          { selectedColumnIds: ['bad1', 'bad2'] },
        ),
      ).toMatchObject({
        success: false,
        error: 'invalid_columns',
        invalidColumns: ['bad1', 'bad2'],
      })
    })
  })

  describe('no_columns', () => {
    it('returns no_columns when columns array is empty', () => {
      expect(
        formatTable({ rows: [], columns: [] }, { selectedColumnIds: [] }),
      ).toMatchObject({ success: false, error: 'no_columns' })
    })
  })

  describe('HTML output structure', () => {
    it('wraps output in a border-collapsed table with tbody', () => {
      const result = formatTable(
        { rows: [], columns: COLS },
        { selectedColumnIds: ['col1', 'col2'] },
      )
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.output).toMatch(
          /^<table style="border-collapse: collapse;"><tbody>/,
        )
        expect(result.output).toMatch(/<\/tbody><\/table>$/)
      }
    })

    it('renders column names in the header row with header styling', () => {
      const result = formatTable(
        { rows: [], columns: COLS },
        { selectedColumnIds: ['col1', 'col2'] },
      )
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.output).toContain(
          'background-color: #F3F4F6; font-weight: 600;',
        )
        expect(result.output).toContain('<p style="margin: 0;">Name</p>')
        expect(result.output).toContain('<p style="margin: 0;">Email</p>')
      }
    })

    it('produces only a header row when rows array is empty', () => {
      const result = formatTable(
        { rows: [], columns: COLS },
        { selectedColumnIds: ['col1', 'col2'] },
      )
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.output.match(/<tr>/g)).toHaveLength(1)
      }
    })

    it('renders first data row with white background', () => {
      const result = formatTable(
        { rows: [ROWS[0]], columns: COLS },
        { selectedColumnIds: ['col1', 'col2'] },
      )
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.output).toContain('background-color: #FFFFFF;')
      }
    })

    it('renders second data row with gray background', () => {
      const result = formatTable(
        { rows: ROWS, columns: COLS },
        { selectedColumnIds: ['col1', 'col2'] },
      )
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.output).toContain('background-color: #F9FAFB;')
      }
    })

    it('renders cell values in the correct column order', () => {
      const result = formatTable(
        { rows: [ROWS[0]], columns: COLS },
        { selectedColumnIds: ['col1', 'col2'] },
      )
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.output.indexOf('Alice')).toBeLessThan(
          result.output.indexOf('alice@example.com'),
        )
      }
    })
  })

  describe('HTML escaping', () => {
    it('escapes HTML special characters in column names', () => {
      const cols = [{ id: 'c1', name: '<script>alert(1)</script>' }]
      const result = formatTable(
        { rows: [], columns: cols },
        { selectedColumnIds: ['c1'] },
      )
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.output).not.toContain('<script>')
        expect(result.output).toContain('&lt;script&gt;')
      }
    })

    it('escapes HTML special characters in cell values', () => {
      const result = formatTable(
        {
          rows: [{ data: { col1: '<b>bold</b> & "quoted" & \'single\'' } }],
          columns: [{ id: 'col1', name: 'Content' }],
        },
        { selectedColumnIds: ['col1'] },
      )
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.output).not.toContain('<b>')
        expect(result.output).toContain(
          '&lt;b&gt;bold&lt;/b&gt; &amp; &quot;quoted&quot; &amp; &#039;single&#039;',
        )
      }
    })
  })

  describe('cell value serialization', () => {
    it('renders null cell values as empty strings', () => {
      const result = formatTable(
        {
          rows: [{ data: { col1: null } }],
          columns: [{ id: 'col1', name: 'Name' }],
        },
        { selectedColumnIds: ['col1'] },
      )
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.output).toContain('<p style="margin: 0;"></p>')
      }
    })

    it('renders undefined cell values as empty strings', () => {
      const result = formatTable(
        {
          rows: [{ data: {} }],
          columns: [{ id: 'col1', name: 'Name' }],
        },
        { selectedColumnIds: ['col1'] },
      )
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.output).toContain('<p style="margin: 0;"></p>')
      }
    })

    it('serializes object cell values as JSON (HTML-escaped)', () => {
      const result = formatTable(
        {
          rows: [{ data: { col1: { nested: 'value' } } }],
          columns: [{ id: 'col1', name: 'Data' }],
        },
        { selectedColumnIds: ['col1'] },
      )
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.output).toContain(
          '{&quot;nested&quot;:&quot;value&quot;}',
        )
      }
    })

    it('renders boolean cell values as strings', () => {
      const result = formatTable(
        {
          rows: [{ data: { col1: true, col2: false } }],
          columns: COLS,
        },
        { selectedColumnIds: ['col1', 'col2'] },
      )
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.output).toContain('<p style="margin: 0;">true</p>')
        expect(result.output).toContain('<p style="margin: 0;">false</p>')
      }
    })

    it('renders numeric cell values as strings', () => {
      const result = formatTable(
        {
          rows: [{ data: { col1: 42, col2: 3.14 } }],
          columns: COLS,
        },
        { selectedColumnIds: ['col1', 'col2'] },
      )
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.output).toContain('<p style="margin: 0;">42</p>')
        expect(result.output).toContain('<p style="margin: 0;">3.14</p>')
      }
    })
  })

  describe('limits', () => {
    beforeEach(() => {
      vi.mocked(logger.warn).mockClear()
    })

    const makeTable = (rowCount: number, columnCount: number) => {
      const columns = Array.from({ length: columnCount }, (_, i) => ({
        id: `c${i}`,
        name: `Col ${i}`,
      }))
      const rows = Array.from({ length: rowCount }, () => ({
        data: Object.fromEntries(columns.map((c) => [c.id, 'x'])),
      }))
      return { rows, columns }
    }

    it('renders a duplicated column id once', () => {
      const result = formatTable(
        { rows: ROWS, columns: COLS },
        { selectedColumnIds: ['col1', 'col1', 'col1'] },
      )
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.output.match(/Alice/g)).toHaveLength(1)
      }
    })

    it('quickly rejects one id repeated many times against thousands of rows', () => {
      const start = performance.now()
      const result = formatTable(makeTable(5000, 1), {
        selectedColumnIds: Array(100_000).fill('c0'),
      })
      expect(performance.now() - start).toBeLessThan(500)
      expect(result).toMatchObject({ success: false, error: 'limit_exceeded' })
    })

    it('renders a table at the row and column limits', () => {
      const table = makeTable(
        MAX_TABLE_VARIABLE_ROWS,
        MAX_TABLE_VARIABLE_COLUMNS,
      )
      const result = formatTable(table, {
        selectedColumnIds: table.columns.map((c) => c.id),
      })
      expect(result.success).toBe(true)
    })

    it('returns limit_exceeded for too many distinct columns', () => {
      const table = makeTable(1, MAX_TABLE_VARIABLE_COLUMNS + 1)
      expect(
        formatTable(table, {
          selectedColumnIds: table.columns.map((c) => c.id),
        }),
      ).toMatchObject({ success: false, error: 'limit_exceeded' })
    })

    it('returns limit_exceeded for too many rows', () => {
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
})
