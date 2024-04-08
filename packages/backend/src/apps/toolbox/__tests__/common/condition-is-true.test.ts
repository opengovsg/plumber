import { describe, expect, it } from 'vitest'

import conditionIsTrue from '../../common/condition-is-true'

describe('Condition is true', () => {
  it.each([
    { text: 'abc', expectedResult: true },
    { text: 'def', expectedResult: false },
  ])('supports equals', ({ text, expectedResult }) => {
    const result = conditionIsTrue({
      field: 'abc',
      is: 'is',
      condition: 'equals',
      text,
    })

    expect(result).toEqual(expectedResult)
  })

  it.each([
    { text: -9.9, expectedResult: true },
    { text: 10, expectedResult: true },
    { text: 11, expectedResult: false },
  ])('supports >=', ({ text, expectedResult }) => {
    const result = conditionIsTrue({
      field: 10,
      is: 'is',
      condition: 'gte',
      text,
    })

    expect(result).toEqual(expectedResult)
  })

  it.each([
    { text: 9, expectedResult: true },
    { text: 10, expectedResult: false },
    { text: 11, expectedResult: false },
  ])('supports >', ({ text, expectedResult }) => {
    const result = conditionIsTrue({
      field: 10,
      is: 'is',
      condition: 'gt',
      text,
    })

    expect(result).toEqual(expectedResult)
  })

  it.each([
    { text: 9.9, expectedResult: false },
    { text: 10, expectedResult: true },
    { text: 11, expectedResult: true },
  ])('supports <=', ({ text, expectedResult }) => {
    const result = conditionIsTrue({
      field: 10,
      is: 'is',
      condition: 'lte',
      text,
    })

    expect(result).toEqual(expectedResult)
  })

  it.each([
    { text: -11.123, expectedResult: false },
    { text: -10, expectedResult: false },
    { text: 11, expectedResult: true },
  ])('supports <', ({ text, expectedResult }) => {
    const result = conditionIsTrue({
      field: -10,
      is: 'is',
      condition: 'lt',
      text,
    })

    expect(result).toEqual(expectedResult)
  })

  it.each([
    { field: 'hello', text: 'hello', expectedResult: true },
    { field: 'hello', text: 'll', expectedResult: true },
    { field: 'hello', text: 'abc', expectedResult: false },
    { field: '9.9', text: 9, expectedResult: true },
    { field: '9.9', text: 1, expectedResult: false },
  ])('supports contains', ({ field, text, expectedResult }) => {
    const result = conditionIsTrue({
      field,
      is: 'is',
      condition: 'contains',
      text,
    })

    expect(result).toEqual(expectedResult)
  })

  it.each([
    { field: 'hello', text: 9.9, condition: 'equals', expectedResult: true },
    { field: 10, text: 10, condition: 'gte', expectedResult: false },
    { field: 1, text: -100, condition: 'lt', expectedResult: true },
  ])('supports negation', ({ field, text, condition, expectedResult }) => {
    const result = conditionIsTrue({
      field,
      is: 'not',
      condition,
      text,
    })

    expect(result).toEqual(expectedResult)
  })

  it.each([
    { field: '', expectedResult: true },
    { field: null, expectedResult: true },
    { field: undefined, expectedResult: true },

    // Non string values are always not-empty, even if they're falsey.
    { field: 'hello', expectedResult: false },
    { field: 0, expectedResult: false },
    { field: {}, expectedResult: false },
  ])('is_empty is $expectedResult for $field', ({ field, expectedResult }) => {
    const result = conditionIsTrue({
      field,
      is: 'is',
      condition: 'is_empty',
      text: null,
    })
    expect(result).toEqual(expectedResult)
  })

  it('throws an error for unsupported conditions', () => {
    expect(() =>
      conditionIsTrue({
        field: 10,
        is: 'is',
        condition: 'herp derp',
        text: 11,
      }),
    ).toThrowError(
      'Conditional logic block contains an unknown operator: herp derp',
    )
  })
})
