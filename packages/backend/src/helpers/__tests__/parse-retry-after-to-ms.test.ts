import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { parseRetryAfterToMs } from '../parse-retry-after-to-ms'

describe('parseRetryAfterToMs', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('01 June 2024 00:00:00 GMT'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it.each([null, undefined, ''])(
    'returns null if the input is falsey',
    (input) => {
      expect(parseRetryAfterToMs(input)).toBeNull()
    },
  )

  it.each([
    { input: '42', expectedValue: 42000 },
    { input: '1', expectedValue: 1000 },
    { input: '0', expectedValue: 0 },
  ])(
    'correctly parses Retry-After given in seconds',
    ({ input, expectedValue }) => {
      expect(parseRetryAfterToMs(input)).toEqual(expectedValue)
    },
  )

  it.each([
    { input: 'Sat, 01 June 2024 01:00:00 GMT', expectedValue: 3600 * 1000 },
    { input: 'Sat, 01 June 2024 00:00:00 GMT', expectedValue: 0 },
    // Tolerate some deviations from RFC 9110
    {
      input: 'Saturday, 01 June 2024 01:00:00 GMT',
      expectedValue: 3600 * 1000,
    },
    { input: '01-Jun-2024 01:00:00 GMT', expectedValue: 3600 * 1000 },
  ])(
    'correctly parses Retry-After given as a future date',
    ({ input, expectedValue }) => {
      expect(parseRetryAfterToMs(input)).toEqual(expectedValue)
    },
  )

  it.each([
    'Fri, 31 May 2024 23:59:59 GMT',
    'Thu, 01 June 2023 00:00:00 GMT',
    'Friday, 31 May 2024 01:00:00 GMT',
    '01-May-2024 12:00:00 GMT',
  ])('returns null if Retry-After is a past date', (input) => {
    expect(parseRetryAfterToMs(input)).toBeNull()
  })

  it.each(['topkek', '123-abcd', 'May 2024'])(
    'returns null if Retry-After is badly formatted',
    (input) => {
      expect(parseRetryAfterToMs(input)).toBeNull()
    },
  )
})
