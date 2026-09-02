import { describe, expect, it } from 'vitest'

import {
  MAX_CONDITION_LABEL_LENGTH,
  truncateConditionLabel,
} from '../truncateConditionLabel'

describe('truncateConditionLabel', () => {
  it('leaves a label that already fits untouched', () => {
    expect(truncateConditionLabel('Application status')).toBe(
      'Application status',
    )
    expect(truncateConditionLabel('')).toBe('')
  })

  it('keeps a label of exactly the budget intact', () => {
    const exact = 'FormSG Payments - Amount'
    expect(exact).toHaveLength(MAX_CONDITION_LABEL_LENGTH)
    expect(truncateConditionLabel(exact)).toBe(exact)
  })

  it('cuts one character short to make room for the ellipsis', () => {
    expect(truncateConditionLabel('2. What is your full name?')).toBe(
      '2. What is your full na…',
    )
    expect(truncateConditionLabel('2. What is your full name?')).toHaveLength(
      MAX_CONDITION_LABEL_LENGTH,
    )
  })

  it('drops a trailing separator so the ellipsis does not dangle', () => {
    // FormSG table cell: the cut lands right after " - ".
    expect(
      truncateConditionLabel('2. Row 1 Postal Code - Delivery addresses'),
    ).toBe('2. Row 1 Postal Code…')
  })

  it('drops a trailing space', () => {
    // The cut lands on the space before "(before tax)".
    expect(truncateConditionLabel('Household income range (before tax)')).toBe(
      'Household income range…',
    )
  })

  it('drops a trailing opening bracket', () => {
    const label = `${'A'.repeat(22)}(before tax)`
    expect(truncateConditionLabel(label)).toBe(`${'A'.repeat(22)}…`)
  })

  it('leaves interior whitespace alone', () => {
    // The label is otherwise rendered as the form author wrote it.
    expect(truncateConditionLabel('Finance & Corporate  Services')).toBe(
      'Finance & Corporate  Se…',
    )
  })

  it('cuts a label whose tail is all separators back to the ellipsis', () => {
    expect(truncateConditionLabel(`${'-'.repeat(30)}`)).toBe('…')
  })

  it('still truncates a long label with no separator to trim', () => {
    expect(truncateConditionLabel('a3f1c2e8-4b7d-4e91-9f2c-1d8e5a7b3c04')).toBe(
      'a3f1c2e8-4b7d-4e91-9f2c…',
    )
    expect(truncateConditionLabel('data.results.0.customer.email')).toBe(
      'data.results.0.customer…',
    )
  })
})
