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
    { field: 'hello', text: 'hello', expectedResult: true },
    { field: 'hello', text: 'he', expectedResult: true },
    { field: 'hello', text: 'llo', expectedResult: false },
    { field: '9.9', text: 9, expectedResult: true },
    { field: '9.9', text: 1, expectedResult: false },
  ])('supports begins', ({ field, text, expectedResult }) => {
    const result = conditionIsTrue({
      field,
      is: 'is',
      condition: 'begins',
      text,
    })

    expect(result).toEqual(expectedResult)
  })

  // check all date formats
  it.each([
    { text: '05/11/24', expectedResult: true }, // 'dd/LL/yy'
    { text: '03/11/2024', expectedResult: false }, // 'dd/LL/yyyy'
    { text: '05 Nov 2024', expectedResult: true }, // 'dd LLL yyyy'
    { text: '03 November 2024', expectedResult: false }, // 'dd LLLL yyyy'
  ])('supports before', ({ text, expectedResult }) => {
    const result = conditionIsTrue({
      field: '04 Nov 2024',
      is: 'is',
      condition: 'before',
      text,
    })

    expect(result).toEqual(expectedResult)
  })

  it.each([
    { text: '2024/11/03', expectedResult: true }, // 'yyyy/LL/dd'
    { text: '04 Nov 2024 12:01 AM', expectedResult: false }, // 'dd LLL yyyy hh:mm a'
    { text: '03 Nov 2024 11:59:59 PM', expectedResult: true }, // 'dd LLL yyyy hh:mm:ss a'
  ])('supports after', ({ text, expectedResult }) => {
    const result = conditionIsTrue({
      field: '04 Nov 2024',
      is: 'is',
      condition: 'after',
      text,
    })

    expect(result).toEqual(expectedResult)
  })

  // Test that date formats accept both single-padded and double-padded input
  it.each([
    // d/L/yy accepts both padded and non-padded
    { field: '04/11/24', text: '05/11/24', expectedResult: true },
    { field: '4/11/24', text: '5/11/24', expectedResult: true },
    // d/L/yyyy accepts both padded and non-padded
    { field: '04/11/2024', text: '05/11/2024', expectedResult: true },
    { field: '4/11/2024', text: '5/11/2024', expectedResult: true },
    // d LLL yyyy accepts both padded and non-padded
    { field: '04 Nov 2024', text: '05 Nov 2024', expectedResult: true },
    { field: '4 Nov 2024', text: '5 Nov 2024', expectedResult: true },
    // d LLLL yyyy accepts both padded and non-padded
    {
      field: '04 November 2024',
      text: '05 November 2024',
      expectedResult: true,
    },
    { field: '4 November 2024', text: '5 November 2024', expectedResult: true },
    // yyyy/L/d accepts both padded and non-padded
    { field: '2024/11/04', text: '2024/11/05', expectedResult: true },
    { field: '2024/11/4', text: '2024/11/5', expectedResult: true },
    // d LLL yyyy h:mm a accepts both padded and non-padded
    {
      field: '04 Nov 2024 09:30 AM',
      text: '04 Nov 2024 10:30 AM',
      expectedResult: true,
    },
    {
      field: '4 Nov 2024 9:30 AM',
      text: '4 Nov 2024 10:30 AM',
      expectedResult: true,
    },
    // d LLL yyyy h:mm:ss a accepts both padded and non-padded
    {
      field: '04 Nov 2024 09:30:00 AM',
      text: '04 Nov 2024 10:30:00 AM',
      expectedResult: true,
    },
    {
      field: '4 Nov 2024 9:30:00 AM',
      text: '4 Nov 2024 10:30:00 AM',
      expectedResult: true,
    },
  ])(
    'accepts both single-padded and double-padded date input',
    ({ field, text, expectedResult }) => {
      const result = conditionIsTrue({
        field,
        is: 'is',
        condition: 'before',
        text,
      })

      expect(result).toEqual(expectedResult)
    },
  )

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

    { field: '     ', expectedResult: false },
    { field: `\n`, expectedResult: false },
    { field: `\t`, expectedResult: false },
    { field: 'hello', expectedResult: false },

    // Non string values are always not-empty, even if they're falsey.
    { field: 0, expectedResult: false },
    { field: {}, expectedResult: false },
  ])(
    'supports empty ($expectedResult for $field)',
    ({ field, expectedResult }) => {
      const result = conditionIsTrue({
        field,
        is: 'is',
        condition: 'empty',
        text: null,
      })
      expect(result).toEqual(expectedResult)
    },
  )

  it.each([
    { field: 10, condition: 'gte', text: 'abc' },
    { field: 'abc', condition: 'lt', text: 10 },
    { field: '04 Sep 2024', condition: 'before', text: 'abc' },
    { field: '123', condition: 'before', text: '04 Nov 2024' },
  ])(
    'throws an error for invalid field or value for comparison',
    ({ field, condition, text }) => {
      expect(() =>
        conditionIsTrue({
          field,
          is: 'is',
          condition,
          text,
        }),
      ).toThrowError()
    },
  )

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
