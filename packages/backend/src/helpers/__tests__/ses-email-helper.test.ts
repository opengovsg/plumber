import { describe, expect, it } from 'vitest'

import { formatFromAddress } from '../ses-email-helper'

describe('formatFromAddress', () => {
  it('leaves a simple display name unquoted', () => {
    expect(formatFromAddress('HR Department', 'info@plumber.gov.sg')).toBe(
      'HR Department <info@plumber.gov.sg>',
    )
  })

  it('quotes a display name containing a comma (the SES-breaking case)', () => {
    expect(formatFromAddress('Acme, Inc', 'info@plumber.gov.sg')).toBe(
      '"Acme, Inc" <info@plumber.gov.sg>',
    )
  })

  it('quotes other RFC 5322 specials (semicolon, colon, parens)', () => {
    expect(formatFromAddress('Dept; Unit', 'a@b.gov.sg')).toBe(
      '"Dept; Unit" <a@b.gov.sg>',
    )
    expect(formatFromAddress('Team (Ops)', 'a@b.gov.sg')).toBe(
      '"Team (Ops)" <a@b.gov.sg>',
    )
  })

  it('escapes embedded quotes and backslashes when quoting', () => {
    expect(formatFromAddress('A, "B" \\C', 'a@b.gov.sg')).toBe(
      '"A, \\"B\\" \\\\C" <a@b.gov.sg>',
    )
  })
})
