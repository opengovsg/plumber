import { describe, expect, it } from 'vitest'

import { sanitizeInternalPath } from '../sso-login'

describe('sanitizeInternalPath', () => {
  it('accepts in-app paths', () => {
    expect(sanitizeInternalPath('/flows')).toBe('/flows')
    expect(sanitizeInternalPath('/editor/abc')).toBe('/editor/abc')
  })

  it('rejects open redirects', () => {
    expect(sanitizeInternalPath('https://evil.example')).toBeUndefined()
    expect(sanitizeInternalPath('//evil.example')).toBeUndefined()
    expect(sanitizeInternalPath('\\evil')).toBeUndefined()
    expect(sanitizeInternalPath(null)).toBeUndefined()
  })
})
