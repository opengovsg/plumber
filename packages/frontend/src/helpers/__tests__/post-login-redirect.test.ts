import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import {
  consumePostLoginRedirect,
  isSafeInternalPath,
  POST_LOGIN_REDIRECT_KEY,
  storePostLoginRedirect,
} from '../post-login-redirect'

describe('isSafeInternalPath', () => {
  it('accepts same-origin relative paths', () => {
    expect(isSafeInternalPath('/')).toBe(true)
    expect(isSafeInternalPath('/pipes')).toBe(true)
    expect(isSafeInternalPath('/editor/123?tab=1#step')).toBe(true)
  })

  it('rejects protocol-relative and backslash open-redirect probes', () => {
    expect(isSafeInternalPath('//attacker.com')).toBe(false)
    expect(isSafeInternalPath('//attacker.com/phish')).toBe(false)
    expect(isSafeInternalPath('/\\attacker.com')).toBe(false)
    expect(isSafeInternalPath('/\\\\attacker.com')).toBe(false)
    expect(isSafeInternalPath('\\attacker.com')).toBe(false)
  })

  it('rejects absolute URLs, schemes, and control characters', () => {
    expect(isSafeInternalPath('https://attacker.com')).toBe(false)
    expect(isSafeInternalPath('http://attacker.com')).toBe(false)
    expect(isSafeInternalPath('javascript:alert(1)')).toBe(false)
    expect(isSafeInternalPath('/pipes\nhttps://attacker.com')).toBe(false)
    expect(isSafeInternalPath(null)).toBe(false)
    expect(isSafeInternalPath('')).toBe(false)
    expect(isSafeInternalPath('pipes')).toBe(false)
  })
})

describe('storePostLoginRedirect', () => {
  // The frontend suite runs in node, so these browser globals are absent.
  beforeAll(() => {
    const store = new Map<string, string>()
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
    })
    vi.stubGlobal('window', { location: { origin: 'https://plumber.gov.sg' } })
  })

  afterEach(() => {
    sessionStorage.clear()
  })

  it('stores a safe relative path', () => {
    storePostLoginRedirect('/pipes/abc')
    expect(sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY)).toBe('/pipes/abc')
  })

  it('does not store a backslash open-redirect probe', () => {
    storePostLoginRedirect('/\\attacker.com')
    expect(sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY)).toBeNull()
  })

  it('does not return an unsafe stored value', () => {
    sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, '/\\attacker.com')
    expect(consumePostLoginRedirect()).toBeNull()
    expect(sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY)).toBeNull()
  })
})
