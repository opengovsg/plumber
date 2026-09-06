import { describe, expect, it } from 'vitest'

import { isAllowedSsoEmail } from '../sso-access'

describe('isAllowedSsoEmail', () => {
  it('admits OGP officers', () => {
    expect(isAllowedSsoEmail('officer@open.gov.sg')).toBe(true)
  })

  it('does not admit other agencies by domain', () => {
    expect(isAllowedSsoEmail('officer@agency.gov.sg')).toBe(false)
  })

  it('does not admit a non-OGP mailbox', () => {
    expect(isAllowedSsoEmail('vendor@example.com')).toBe(false)
  })
})
