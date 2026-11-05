import { describe, expect, it } from 'vitest'

import { parseApiTimestamp } from './surveys'

describe('parseApiTimestamp', () => {
  it('parses epoch milliseconds from the API', () => {
    expect(parseApiTimestamp('1730000000000')).toEqual(new Date(1730000000000))
  })

  it('parses an ISO string', () => {
    expect(parseApiTimestamp('2026-06-01T00:00:00.000Z')).toEqual(
      new Date('2026-06-01T00:00:00.000Z'),
    )
  })

  it.each([undefined, null, '', 'not a date'])(
    'returns null for %s',
    (value) => {
      expect(parseApiTimestamp(value)).toBeNull()
    },
  )
})
