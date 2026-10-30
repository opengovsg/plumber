import { describe, expect, it } from 'vitest'

import { toPgRow } from '@/models/tiles/migration/to-pg-row'

const CREATED_AT = Date.parse('2026-10-18T17:00:00.123Z')
const UPDATED_AT = Date.parse('2026-10-19T01:02:03.456Z')

function item(data?: Record<string, unknown> | null) {
  return { rowId: 'row-1', data, createdAt: CREATED_AT, updatedAt: UPDATED_AT }
}

describe('toPgRow', () => {
  it.each([
    [0, '2026-10-18T17:00:00.123000Z'],
    [1, '2026-10-18T17:00:00.123001Z'],
    [999, '2026-10-18T17:00:00.123999Z'],
  ])('offsets createdAt by tie index %i', (tieIndex, expected) => {
    const { row } = toPgRow(item({}), [], tieIndex)
    expect(row.createdAt).toBe(expected)
    expect(row.updatedAt).toEqual(new Date(UPDATED_AT))
    expect(row.rowId).toBe('row-1')
  })

  it('throws at tie index 1000', () => {
    expect(() => toPgRow(item({}), [], 1000)).toThrow()
  })

  it('maps values to strings or null and drops unknown keys', () => {
    const { row, strippedNullChars } = toPgRow(
      item({
        a: 7,
        b: true,
        c: 'text',
        d: null,
        e: { nested: 1 },
        dead: 'gone',
      }),
      ['a', 'b', 'c', 'd', 'e', 'missing'],
      0,
    )
    expect(row).toMatchObject({
      a: '7',
      b: 'true',
      c: 'text',
      d: null,
      e: '{"nested":1}',
      missing: null,
    })
    expect(row).not.toHaveProperty('dead')
    expect(strippedNullChars).toBe(0)
  })

  it('maps an item with no data to null cells', () => {
    const { row } = toPgRow(item(undefined), ['a'], 0)
    expect(row.a).toBeNull()
  })

  it('removes U+0000 and counts it', () => {
    const { row, strippedNullChars } = toPgRow(
      item({ a: 'x\u0000y\u0000', b: '\u0000' }),
      ['a', 'b'],
      0,
    )
    expect(row.a).toBe('xy')
    expect(row.b).toBe('')
    expect(strippedNullChars).toBe(3)
  })
})
