import { describe, expect, it, vi } from 'vitest'

import { ONEGOV_FEATURE_FLAG } from '@/config/flags'

import { resolveShouldShowSsoLogin } from './resolveShouldShowSsoLogin'

function stubFlag(value: unknown) {
  return vi.fn().mockReturnValue(value)
}

describe('resolveShouldShowSsoLogin', () => {
  it("reads onegov-enabled with an 'off' fallback", () => {
    const getFlagValue = stubFlag('off')

    resolveShouldShowSsoLogin(getFlagValue, undefined)

    expect(getFlagValue).toHaveBeenCalledWith(ONEGOV_FEATURE_FLAG, 'off')
  })

  it("shows SSO when the flag is 'all', even without OGP Wi-Fi", () => {
    expect(resolveShouldShowSsoLogin(stubFlag('all'), undefined)).toBe(true)
    expect(resolveShouldShowSsoLogin(stubFlag('all'), '')).toBe(true)
    expect(resolveShouldShowSsoLogin(stubFlag('all'), 'false')).toBe(true)
  })

  it("hides SSO when the flag is 'off', even on OGP Wi-Fi", () => {
    expect(resolveShouldShowSsoLogin(stubFlag('off'), 'true')).toBe(false)
    expect(resolveShouldShowSsoLogin(stubFlag('off'), undefined)).toBe(false)
  })

  it("shows SSO when the flag is 'ogp' and the Wi-Fi header is true", () => {
    expect(resolveShouldShowSsoLogin(stubFlag('ogp'), 'true')).toBe(true)
  })

  it("hides SSO when the flag is 'ogp' and the Wi-Fi header is not true", () => {
    expect(resolveShouldShowSsoLogin(stubFlag('ogp'), undefined)).toBe(false)
    expect(resolveShouldShowSsoLogin(stubFlag('ogp'), '')).toBe(false)
    expect(resolveShouldShowSsoLogin(stubFlag('ogp'), 'false')).toBe(false)
  })

  it("hides SSO when LaunchDarkly omits the flag and the 'off' fallback is used", () => {
    const getFlagValue = vi.fn(
      (_flagKey: string, defaultValue?: unknown) => defaultValue,
    )

    expect(resolveShouldShowSsoLogin(getFlagValue, 'true')).toBe(false)
    expect(getFlagValue).toHaveBeenCalledWith(ONEGOV_FEATURE_FLAG, 'off')
  })
})
