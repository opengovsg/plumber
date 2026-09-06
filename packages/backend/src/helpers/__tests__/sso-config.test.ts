import { generateKeyPairSync } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import {
  expectedIssuerFromDiscoveryUrl,
  pemToPrivateJwks,
  unescapePem,
} from '../sso-config'

describe('sso-config', () => {
  it('strips a well-known suffix and keeps /api/auth on the issuer', () => {
    expect(
      expectedIssuerFromDiscoveryUrl(
        'https://one.gov.sg/api/auth/.well-known/openid-configuration',
      ),
    ).toBe('https://one.gov.sg/api/auth')
  })

  it('does not treat the origin as the issuer', () => {
    expect(expectedIssuerFromDiscoveryUrl('https://one.gov.sg/api/auth')).toBe(
      'https://one.gov.sg/api/auth',
    )
  })

  it('unescapes PEM newlines stored in env', () => {
    expect(unescapePem('line1\\nline2')).toBe('line1\nline2')
  })

  it('converts a PKCS#8 PEM into a private JWKS for openid-client', () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
    const jwks = pemToPrivateJwks(pem.replace(/\n/g, '\\n'))

    expect(jwks.keys).toHaveLength(1)
    expect(jwks.keys[0].kty).toBe('RSA')
    expect(jwks.keys[0].alg).toBe('RS256')
    expect(jwks.keys[0].d).toBeTruthy()
    expect(jwks.keys[0].kid).toMatch(/^[A-Za-z0-9_-]+$/)
  })
})
