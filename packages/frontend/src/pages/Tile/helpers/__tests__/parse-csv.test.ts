import { afterEach, describe, expect, it, vi } from 'vitest'

import { parseTileCsv } from '../parse-csv'

describe('parseTileCsv', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps distinct quoted headers that contain commas', () => {
    const parsed = parseTileCsv('"Role (A, B)","Team (C, B)"\nalpha,beta\n')

    expect(parsed).toEqual({
      ok: true,
      columns: ['Role (A, B)', 'Team (C, B)'],
      rows: [{ 'Role (A, B)': 'alpha', 'Team (C, B)': 'beta' }],
    })
  })

  it('renames repeated quoted headers so each column stays unique', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const parsed = parseTileCsv(
      '"Member (Name, Email)","Member (Name, Email)","Member (Name, Email)"\na,b,c\n',
    )

    expect(parsed).toEqual({
      ok: true,
      columns: [
        'Member (Name, Email)',
        'Member (Name, Email)_1',
        'Member (Name, Email)_2',
      ],
      rows: [
        {
          'Member (Name, Email)': 'a',
          'Member (Name, Email)_1': 'b',
          'Member (Name, Email)_2': 'c',
        },
      ],
    })
  })

  it('names a blank header (empty)', () => {
    const parsed = parseTileCsv('Name,,City\nAnn,,Town\n')

    expect(parsed).toEqual({
      ok: true,
      columns: ['Name', '(empty)', 'City'],
      rows: [{ Name: 'Ann', '(empty)': '', City: 'Town' }],
    })
  })

  it('returns columns when the file has no data rows', () => {
    const parsed = parseTileCsv('"Size (S, M)","Color"\n')

    expect(parsed).toEqual({
      ok: true,
      columns: ['Size (S, M)', 'Color'],
      rows: [],
    })
  })

  it('trims header whitespace', () => {
    const parsed = parseTileCsv('"  Name  ",Email\nAnn,a@example.com\n')

    expect(parsed).toEqual({
      ok: true,
      columns: ['Name', 'Email'],
      rows: [{ Name: 'Ann', Email: 'a@example.com' }],
    })
  })

  it('rejects a file with an unterminated quote', () => {
    const parsed = parseTileCsv('"Name,Email\nAnn,a@example.com\n')

    expect(parsed).toEqual({
      ok: false,
      error: 'Quoted field unterminated',
    })
  })

  it('keeps rows when a data row has fewer fields', () => {
    const parsed = parseTileCsv('Name,City\nAnn\n')

    expect(parsed).toEqual({
      ok: true,
      columns: ['Name', 'City'],
      rows: [{ Name: 'Ann' }],
    })
  })

  it('rejects a file with no columns', () => {
    expect(parseTileCsv('')).toEqual({
      ok: false,
      error: 'This CSV has no columns.',
    })
  })
})
