import { describe, expect, it } from 'vitest'

import { NOT_AUTHORISED } from '@/config/errors'

import { getLoginRedirectHref, isNotAuthorisedError } from '../redirectToLogin'

describe('redirectToLogin helpers', () => {
  it('encodes the current path as a login redirect query param', () => {
    expect(getLoginRedirectHref('/editor/ai')).toBe(
      '/login/?redirect=%2Feditor%2Fai',
    )
  })

  it('detects the backend not-authorised message and JSON error bodies', () => {
    expect(isNotAuthorisedError({ message: NOT_AUTHORISED })).toBe(true)
    expect(
      isNotAuthorisedError({
        message: JSON.stringify({ error: NOT_AUTHORISED }),
      }),
    ).toBe(true)
    expect(isNotAuthorisedError({ message: 'Failed to fetch' })).toBe(false)
  })
})
