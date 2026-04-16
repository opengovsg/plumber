import type { ITableColumnMetadata } from '@plumber/types'

import { describe, expect, it } from 'vitest'

import type { GenericRowData } from '../../types'
import { buildCsv } from '../build-csv'

const cols = (...names: string[]): ITableColumnMetadata[] =>
  names.map((name, i) => ({
    id: `col${i + 1}`,
    name,
    position: i,
    config: {},
  })) as unknown as ITableColumnMetadata[]

describe('buildCsv', () => {
  it('returns null when there are no columns (nothing to export)', () => {
    expect(buildCsv([], [])).toBeNull()
    expect(
      buildCsv(
        [{ rowId: 'r1', col1: 'orphan' } as unknown as GenericRowData],
        [],
      ),
    ).toBeNull()
  })

  it('produces a header-only CSV when there are columns but no rows', () => {
    expect(buildCsv([], cols('Name', 'Email'))).toBe('Name,Email\r\n')
  })

  it('produces header + data rows when rows are present', () => {
    const columns = cols('Name', 'Email')
    const rows = [
      { rowId: 'r1', col1: 'Alice', col2: 'alice@example.com' },
      { rowId: 'r2', col1: 'Bob', col2: 'bob@example.com' },
    ] as unknown as GenericRowData[]

    expect(buildCsv(rows, columns)).toBe(
      'Name,Email\r\nAlice,alice@example.com\r\nBob,bob@example.com',
    )
  })

  it('escapes values containing commas by wrapping them in double quotes', () => {
    const columns = cols('Name', 'Address')
    const rows = [
      { rowId: 'r1', col1: 'Alice', col2: '1 Main St, Apt 2' },
    ] as unknown as GenericRowData[]

    expect(buildCsv(rows, columns)).toBe(
      'Name,Address\r\nAlice,"1 Main St, Apt 2"',
    )
  })

  it('escapes values containing double quotes by doubling them', () => {
    const columns = cols('Name', 'Quote')
    const rows = [
      { rowId: 'r1', col1: 'Alice', col2: 'She said "hi"' },
    ] as unknown as GenericRowData[]

    expect(buildCsv(rows, columns)).toBe(
      'Name,Quote\r\nAlice,"She said ""hi"""',
    )
  })

  it('escapes values containing newlines by wrapping them in double quotes', () => {
    const columns = cols('Name', 'Note')
    const rows = [
      { rowId: 'r1', col1: 'Alice', col2: 'line1\nline2' },
    ] as unknown as GenericRowData[]

    expect(buildCsv(rows, columns)).toBe('Name,Note\r\nAlice,"line1\nline2"')
  })

  it('escapes column names containing commas/quotes', () => {
    const columns = cols('Name, Full', 'He said "x"')
    expect(buildCsv([], columns)).toBe('"Name, Full","He said ""x"""\r\n')
  })

  it('maps row keys (column IDs) to column names in the output header', () => {
    const columns = cols('First Name', 'Last Name')
    const rows = [
      { rowId: 'r1', col1: 'Ada', col2: 'Lovelace' },
    ] as unknown as GenericRowData[]

    const csv = buildCsv(rows, columns)
    expect(csv).toContain('First Name,Last Name')
    expect(csv).toContain('Ada,Lovelace')
    // rowId should not appear under an undefined column
    expect(csv).not.toContain('undefined')
    expect(csv).not.toContain('r1')
  })

  it('emits an empty cell for a column missing from a row', () => {
    const columns = cols('Name', 'Email')
    const rows = [
      { rowId: 'r1', col1: 'Alice' }, // no col2
    ] as unknown as GenericRowData[]

    expect(buildCsv(rows, columns)).toBe('Name,Email\r\nAlice,')
  })
})
