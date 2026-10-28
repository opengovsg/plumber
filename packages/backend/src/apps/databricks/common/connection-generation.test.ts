import { describe, expect, it } from 'vitest'

import { parseDatabricksGeneration } from './connection-generation'

describe('parseDatabricksGeneration', () => {
  it('parses a missing generation as legacy', () => {
    expect(parseDatabricksGeneration(undefined)).toBe('legacy')
    expect(parseDatabricksGeneration(null)).toBe('legacy')
  })

  it('parses legacy', () => {
    expect(parseDatabricksGeneration('legacy')).toBe('legacy')
  })

  it('parses new', () => {
    expect(parseDatabricksGeneration('new')).toBe('new')
  })

  it('throws on a bad string', () => {
    expect(() => parseDatabricksGeneration('other')).toThrow()
  })
})
