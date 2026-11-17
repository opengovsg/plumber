import { describe, expect, it } from 'vitest'

import {
  parseDatabricksGeneration,
  readDatabricksGeneration,
} from '../../common/connection-generation'

describe('parseDatabricksGeneration', () => {
  it('reads a missing value as legacy and keeps known values', () => {
    expect(parseDatabricksGeneration(undefined)).toBe('legacy')
    expect(parseDatabricksGeneration(null)).toBe('legacy')
    expect(parseDatabricksGeneration('legacy')).toBe('legacy')
    expect(parseDatabricksGeneration('new')).toBe('new')
  })

  it('throws on a bad string', () => {
    expect(() => parseDatabricksGeneration('other')).toThrow(
      /Unknown Databricks generation/,
    )
  })
})

describe('readDatabricksGeneration', () => {
  it('returns null for a bad stored value', () => {
    expect(readDatabricksGeneration('other')).toBeNull()
  })

  it('reads a missing value as legacy and keeps known values', () => {
    expect(readDatabricksGeneration(undefined)).toBe('legacy')
    expect(readDatabricksGeneration(null)).toBe('legacy')
    expect(readDatabricksGeneration('legacy')).toBe('legacy')
    expect(readDatabricksGeneration('new')).toBe('new')
  })
})
