import { describe, expect, it } from 'vitest'

import { getLoginRedirectHref } from '../redirectToLogin'

describe('getLoginRedirectHref', () => {
  it('encodes the current path as a login redirect query param', () => {
    expect(getLoginRedirectHref('/editor/ai')).toBe(
      '/login/?redirect=%2Feditor%2Fai',
    )
  })
})
