import { describe, expect, it } from 'vitest'

import { wrapRowsIntoSingleGroup } from '../wrap-rows-into-single-group'

describe('wrapRowsIntoSingleGroup', () => {
  it('collapses a multi-row AND-list into exactly ONE group', () => {
    const rows = [
      { field: 'a', is: 'is', condition: 'equals', text: 'a' },
      { field: 'b', is: 'is', condition: 'equals', text: 'b' },
      { field: 'c', is: 'is', condition: 'equals', text: 'c' },
    ]

    const result = wrapRowsIntoSingleGroup(rows)

    // The whole point: one group preserving AND — never one-group-per-row.
    expect(result).toHaveLength(1)
    expect(result[0].rows).toEqual(rows)
  })

  it('wraps a single row into one group', () => {
    const rows = [{ field: 'a', is: 'is', condition: 'equals', text: 'a' }]
    expect(wrapRowsIntoSingleGroup(rows)).toEqual([{ rows }])
  })

  it('wraps an empty list into one empty group', () => {
    expect(wrapRowsIntoSingleGroup([])).toEqual([{ rows: [] }])
  })

  it('preserves row order and content', () => {
    const rows = [{ id: 1 }, { id: 2 }, { id: 3 }]
    expect(wrapRowsIntoSingleGroup(rows)[0].rows).toEqual([
      { id: 1 },
      { id: 2 },
      { id: 3 },
    ])
  })
})
