import { describe, expect, it } from 'vitest'

import { UserFacingError } from '@/errors/user-facing-error'

import {
  MAX_COLUMNS_PER_CALL,
  parseAddTileColumnsInput,
  parseColumnNames,
  parseCreateTileInput,
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

  it('accepts unicode names, matching updateTable', () => {
    expect(parseColumnNames(['客户', 'Café', '🎉'])).toEqual([
      '客户',
      'Café',
      '🎉',
    ])
  })
})

describe('parseCreateTileInput', () => {
  it('accepts an optional UUID pipeId', () => {
    expect(
      parseCreateTileInput({
        name: 'Leave',
        columns: ['Name'],
        pipeId: '123e4567-e89b-12d3-a456-426614174000',
      }),
    ).toMatchObject({
      pipeId: '123e4567-e89b-12d3-a456-426614174000',
    })
  })

  it('rejects a non-UUID pipeId', () => {
    expect(() =>
      parseCreateTileInput({
        name: 'Leave',
        columns: ['Name'],
        pipeId: 'not-a-uuid',
      }),
    ).toThrow(UserFacingError)
  })
})

describe('parseAddTileColumnsInput', () => {
  const SAMPLE_ULID = '01ARZ3NDEKTSV4RRFFQ69G5FAV'

  it('accepts a UUID tableId', () => {
    expect(
      parseAddTileColumnsInput({
        tableId: '123e4567-e89b-12d3-a456-426614174111',
        columns: ['Notes'],
      }),
    ).toMatchObject({ tableId: '123e4567-e89b-12d3-a456-426614174111' })
  })

  it('accepts a ULID tableId', () => {
    expect(
      parseAddTileColumnsInput({
        tableId: SAMPLE_ULID,
        columns: ['Notes'],
      }),
    ).toMatchObject({ tableId: SAMPLE_ULID })
  })

  it('rejects a tableId that is neither UUID nor ULID', () => {
    expect(() =>
      parseAddTileColumnsInput({
        tableId: 'not-an-id',
        columns: ['Notes'],
      }),
    ).toThrow(UserFacingError)
  })
})
