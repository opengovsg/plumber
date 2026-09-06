import { describe, expect, it } from 'vitest'

import { decideSsoCallback } from '../sso-callback'

const issuer = 'https://one.gov.sg/api/auth'
const storedState = 'csrf-state'

describe('decideSsoCallback', () => {
  it('stops on an IdP error before checking code', () => {
    expect(
      decideSsoCallback({
        query: {
          error: 'access_denied',
          state: storedState,
          iss: issuer,
          code: 'should-not-exchange',
        },
        storedState,
        issuer,
      }),
    ).toEqual({ type: 'idp-error' })
  })

  it('rejects a state mismatch', () => {
    expect(
      decideSsoCallback({
        query: { state: 'other', iss: issuer, code: 'abc' },
        storedState,
        issuer,
      }),
    ).toEqual({ type: 'invalid' })
  })

  it('rejects a bare-origin iss parameter', () => {
    expect(
      decideSsoCallback({
        query: {
          state: storedState,
          iss: 'https://one.gov.sg',
          code: 'abc',
        },
        storedState,
        issuer,
      }),
    ).toEqual({ type: 'invalid' })
  })

  it('rejects a missing iss parameter', () => {
    expect(
      decideSsoCallback({
        query: { state: storedState, code: 'abc' },
        storedState,
        issuer,
      }),
    ).toEqual({ type: 'invalid' })
  })

  it('rejects a missing code after the other checks pass', () => {
    expect(
      decideSsoCallback({
        query: { state: storedState, iss: issuer },
        storedState,
        issuer,
      }),
    ).toEqual({ type: 'invalid' })
  })

  it('accepts a valid callback', () => {
    expect(
      decideSsoCallback({
        query: { state: storedState, iss: issuer, code: 'abc' },
        storedState,
        issuer,
      }),
    ).toEqual({ type: 'ok', code: 'abc' })
  })
})
