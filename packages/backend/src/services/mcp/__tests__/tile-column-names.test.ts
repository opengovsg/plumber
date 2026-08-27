import { describe, expect, it } from 'vitest'

import { UserFacingError } from '@/errors/user-facing-error'

import {
  MAX_COLUMNS_PER_CALL,
  parseColumnNames,
  parseTileName,
} from '../tile-column-names'

describe('parseTileName', () => {
  it('trims and returns the name', () => {
    expect(parseTileName('  Leave applications  ')).toBe('Leave applications')
  })

  it('rejects an empty name', () => {
    expect(() => parseTileName('   ')).toThrow(UserFacingError)
  })

  it('rejects names longer than 64 characters', () => {
    expect(() => parseTileName('a'.repeat(65))).toThrow(UserFacingError)
  })
})

describe('parseColumnNames', () => {
  it('trims names and preserves order', () => {
    expect(parseColumnNames([' Name ', 'Start date'])).toEqual([
      'Name',
      'Start date',
    ])
  })

  it('rejects an empty list', () => {
    expect(() => parseColumnNames([])).toThrow(UserFacingError)
  })

  it('rejects more than 50 names', () => {
    expect(() =>
      parseColumnNames(
        Array.from({ length: MAX_COLUMNS_PER_CALL + 1 }, (_, i) => `Col ${i}`),
      ),
    ).toThrow(UserFacingError)
  })

  it('rejects duplicate names case-insensitively', () => {
    expect(() => parseColumnNames(['Name', 'name'])).toThrow(UserFacingError)
  })

  it('rejects disallowed characters', () => {
    expect(() => parseColumnNames(['Name\nbreak'])).toThrow(UserFacingError)
  })
})
