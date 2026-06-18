import { describe, expect, it } from 'vitest'

import { canAddGroup, canAddRow, normalizeGroupsValue } from './helpers'

describe('normalizeGroupsValue', () => {
  it('returns a single empty group for missing/empty/non-array values', () => {
    expect(normalizeGroupsValue(undefined)).toEqual([{ rows: [] }])
    expect(normalizeGroupsValue(null)).toEqual([{ rows: [] }])
    expect(normalizeGroupsValue([])).toEqual([{ rows: [] }])
    expect(normalizeGroupsValue('nope')).toEqual([{ rows: [] }])
  })

  it('passes through an existing non-empty groups array unchanged', () => {
    const groups = [{ rows: [{ field: 'a' }] }, { rows: [{ field: 'b' }] }]
    expect(normalizeGroupsValue(groups)).toBe(groups)
  })
})

describe('canAddGroup (group cap)', () => {
  it('allows adding when no cap is set', () => {
    expect(canAddGroup(99)).toBe(true)
  })

  it('allows adding below the cap and blocks at/above it', () => {
    expect(canAddGroup(9, 10)).toBe(true)
    expect(canAddGroup(10, 10)).toBe(false)
    expect(canAddGroup(11, 10)).toBe(false)
  })
})

describe('canAddRow (row cap)', () => {
  it('allows adding when no cap is set', () => {
    expect(canAddRow(99)).toBe(true)
  })

  it('allows adding below the cap and blocks at/above it', () => {
    expect(canAddRow(9, 10)).toBe(true)
    expect(canAddRow(10, 10)).toBe(false)
  })
})
