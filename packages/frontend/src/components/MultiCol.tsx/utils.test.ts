import { describe, expect, it } from 'vitest'

import { applyDynamicPlaceholder } from './utils'

const baseSubField = {
  key: 'fieldName',
  type: 'string' as const,
  label: 'Output name',
  placeholder: 'E.g., Summary',
}

describe('applyDynamicPlaceholder', () => {
  it('returns the original schema when dynamicPlaceholderKey is not set', () => {
    const result = applyDynamicPlaceholder(baseSubField, {
      fieldNameHint: 'summary',
    })
    expect(result).toBe(baseSubField)
  })

  it('overrides placeholder with the hint when key is present and non-empty', () => {
    const subF = { ...baseSubField, dynamicPlaceholderKey: 'fieldNameHint' }
    const result = applyDynamicPlaceholder(subF, { fieldNameHint: 'summary' })
    expect(result.placeholder).toBe('summary')
  })

  it('preserves all other schema properties when overriding placeholder', () => {
    const subF = { ...baseSubField, dynamicPlaceholderKey: 'fieldNameHint' }
    const result = applyDynamicPlaceholder(subF, { fieldNameHint: 'summary' })
    expect(result.key).toBe(baseSubField.key)
    expect(result.label).toBe(baseSubField.label)
    expect(result.type).toBe(baseSubField.type)
  })

  it('returns original schema when hint key is absent from rowValues', () => {
    const subF = { ...baseSubField, dynamicPlaceholderKey: 'fieldNameHint' }
    const result = applyDynamicPlaceholder(subF, {})
    expect(result).toBe(subF)
  })

  it('returns original schema when rowValues is undefined', () => {
    const subF = { ...baseSubField, dynamicPlaceholderKey: 'fieldNameHint' }
    const result = applyDynamicPlaceholder(subF, undefined)
    expect(result).toBe(subF)
  })

  it('returns original schema when hint is an empty string', () => {
    const subF = { ...baseSubField, dynamicPlaceholderKey: 'fieldNameHint' }
    const result = applyDynamicPlaceholder(subF, { fieldNameHint: '' })
    expect(result).toBe(subF)
  })

  it('returns original schema when hint is a non-string value', () => {
    const subF = { ...baseSubField, dynamicPlaceholderKey: 'fieldNameHint' }
    expect(
      applyDynamicPlaceholder(subF, { fieldNameHint: 42 }).placeholder,
    ).toBe(baseSubField.placeholder)
    expect(
      applyDynamicPlaceholder(subF, { fieldNameHint: true }).placeholder,
    ).toBe(baseSubField.placeholder)
    expect(
      applyDynamicPlaceholder(subF, { fieldNameHint: null }).placeholder,
    ).toBe(baseSubField.placeholder)
  })
})
