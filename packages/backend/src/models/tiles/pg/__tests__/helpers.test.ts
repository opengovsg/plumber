import { describe, expect, it } from 'vitest'

import { isValidNumericString } from '../helpers'

describe('pg tiles helpers', () => {
  it.each([
    ['123'],
    ['-123'],
    ['0'],
    ['5'],
    ['0.123'],
    ['-0.123'],
    ['123.456'],
    ['-123.456'],
    ['-0.0000001'],
    ['0.00'],
  ])('should return true if the string is a valid numeric string', (value) => {
    expect(isValidNumericString(value)).toBe(true)
  })

  it.each([
    ['not a number'],
    ['123.456.789'],
    ['-.213'],
    ['+23'],
    ['00.379'],
    ['01'],
    ['00'],
    ['00.00'],
    ['1e6'],
    ['99-99'],
    ['--12'],
  ])(
    'should return false if the string is not a valid numeric string',
    (value) => {
      expect(isValidNumericString(value)).toBe(false)
    },
  )
})
