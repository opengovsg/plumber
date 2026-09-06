import { describe, expect, it } from 'vitest'

import { assertVerifiedIdTokenClaims } from '../sso-id-token'

const issuer = 'https://one.gov.sg/api/auth'
const clientId = 'plumber-prod'
const nonce = 'stored-nonce'

function claims(overrides: Record<string, unknown> = {}) {
  return {
    iss: issuer,
    sub: 'officer@open.gov.sg',
    aud: clientId,
    exp: 1,
    iat: 1,
    nonce,
    email: 'officer@open.gov.sg',
    sid: 'sid-1',
    ...overrides,
  }
}

describe('assertVerifiedIdTokenClaims', () => {
  it('accepts a single-audience token with required claims', () => {
    expect(
      assertVerifiedIdTokenClaims({
        claims: claims(),
        issuer,
        clientId,
        nonce,
      }),
    ).toEqual({
      sub: 'officer@open.gov.sg',
      email: 'officer@open.gov.sg',
      sid: 'sid-1',
    })
  })

  it('accepts a one-element audience array', () => {
    expect(
      assertVerifiedIdTokenClaims({
        claims: claims({ aud: [clientId] }),
        issuer,
        clientId,
        nonce,
      }).sub,
    ).toBe('officer@open.gov.sg')
  })

  it('rejects a multi-audience token', () => {
    expect(() =>
      assertVerifiedIdTokenClaims({
        claims: claims({ aud: [clientId, 'other-rp'] }),
        issuer,
        clientId,
        nonce,
      }),
    ).toThrow('audience')
  })

  it('rejects a mismatched azp when present', () => {
    expect(() =>
      assertVerifiedIdTokenClaims({
        claims: claims({ azp: 'other-rp' }),
        issuer,
        clientId,
        nonce,
      }),
    ).toThrow('authorized party')
  })

  it('does not require azp', () => {
    expect(
      assertVerifiedIdTokenClaims({
        claims: claims(),
        issuer,
        clientId,
        nonce,
      }).sub,
    ).toBe('officer@open.gov.sg')
  })

  it('rejects a bare-origin issuer', () => {
    expect(() =>
      assertVerifiedIdTokenClaims({
        claims: claims({ iss: 'https://one.gov.sg' }),
        issuer,
        clientId,
        nonce,
      }),
    ).toThrow('issuer')
  })

  it('rejects a missing nonce claim', () => {
    const body = claims()
    delete body.nonce
    expect(() =>
      assertVerifiedIdTokenClaims({
        claims: body,
        issuer,
        clientId,
        nonce,
      }),
    ).toThrow('required claim')
  })

  it('rejects a nonce that does not match the transaction', () => {
    expect(() =>
      assertVerifiedIdTokenClaims({
        claims: claims({ nonce: 'other' }),
        issuer,
        clientId,
        nonce,
      }),
    ).toThrow('nonce')
  })

  it('does not require nbf', () => {
    expect(
      assertVerifiedIdTokenClaims({
        claims: claims(),
        issuer,
        clientId,
        nonce,
      }).sub,
    ).toBe('officer@open.gov.sg')
  })
})
