import { describe, expect, it } from 'vitest'

import { applyDynamicPlaceholder } from './utils'

const baseSubField = {
  key: 'fieldName',
  type: 'string' as const,
  label: 'Output name',
  placeholder: 'E.g., Summary',
}

describe('applyDynamicPlaceholder', () => {
  it('overrides placeholder with the `${key}Hint` value when present and non-empty', () => {
    const result = applyDynamicPlaceholder(baseSubField, {
      fieldNameHint: 'summary',
    })
    expect(result.placeholder).toBe('summary')
  })

  it('preserves all other schema properties when overriding placeholder', () => {
    const result = applyDynamicPlaceholder(baseSubField, {
      fieldNameHint: 'summary',
    })
    expect(result.key).toBe(baseSubField.key)
    expect(result.label).toBe(baseSubField.label)
    expect(result.type).toBe(baseSubField.type)
  })

  it('returns original schema when the `${key}Hint` key is absent from rowValues', () => {
    const result = applyDynamicPlaceholder(baseSubField, {})
    expect(result).toBe(baseSubField)
  })

  it('returns original schema when rowValues is undefined', () => {
    const result = applyDynamicPlaceholder(baseSubField, undefined)
    expect(result).toBe(baseSubField)
  })

  it('returns original schema when the hint is an empty string', () => {
    const result = applyDynamicPlaceholder(baseSubField, { fieldNameHint: '' })
    expect(result).toBe(baseSubField)
  })

  it('returns original schema when the hint is a non-string value', () => {
    expect(
      applyDynamicPlaceholder(baseSubField, { fieldNameHint: 42 }).placeholder,
    ).toBe(baseSubField.placeholder)
    expect(
      applyDynamicPlaceholder(baseSubField, { fieldNameHint: true })
        .placeholder,
    ).toBe(baseSubField.placeholder)
    expect(
      applyDynamicPlaceholder(baseSubField, { fieldNameHint: null })
        .placeholder,
    ).toBe(baseSubField.placeholder)
  })
})
