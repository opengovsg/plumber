import { createHash, createPrivateKey } from 'node:crypto'

const WELL_KNOWN_SUFFIX = '/.well-known/openid-configuration'

export function unescapePem(value: string): string {
  return value.replace(/\\n/g, '\n')
}

/**
 * Derives the issuer we will compare against. The IdP's issuer includes
 * `/api/auth`; matching the bare origin fails RFC 9207 and id_token checks.
 */
export function expectedIssuerFromDiscoveryUrl(discoveryUrl: string): string {
  const trimmed = discoveryUrl.replace(/\/+$/, '')
  if (trimmed.endsWith(WELL_KNOWN_SUFFIX)) {
    return trimmed.slice(0, -WELL_KNOWN_SUFFIX.length)
  }
  return trimmed
}

type RsaJwk = {
  kty: string
  n: string
  e: string
  d?: string
  p?: string
  q?: string
  dp?: string
  dq?: string
  qi?: string
  kid: string
  use: 'sig'
  alg: 'RS256'
}

function rsaThumbprint(jwk: { kty: string; n: string; e: string }): string {
  const canonical = JSON.stringify({ e: jwk.e, kty: jwk.kty, n: jwk.n })
  return createHash('sha256').update(canonical).digest('base64url')
}

/**
 * openid-client's private_key_jwt path takes a JWKS. The PEM stays in env;
 * this conversion is in-process only.
 */
export function pemToPrivateJwks(pem: string): { keys: RsaJwk[] } {
  const key = createPrivateKey(unescapePem(pem))
  const jwk = key.export({ format: 'jwk' }) as {
    kty?: string
    n?: string
    e?: string
    d?: string
    p?: string
    q?: string
    dp?: string
    dq?: string
    qi?: string
  }

  if (jwk.kty !== 'RSA' || !jwk.n || !jwk.e) {
    throw new Error('SSO private key must be an RSA PKCS#8 PEM')
  }

  return {
    keys: [
      {
        kty: jwk.kty,
        n: jwk.n,
        e: jwk.e,
        d: jwk.d,
        p: jwk.p,
        q: jwk.q,
        dp: jwk.dp,
        dq: jwk.dq,
        qi: jwk.qi,
        kid: rsaThumbprint({ kty: jwk.kty, n: jwk.n, e: jwk.e }),
        use: 'sig',
        alg: 'RS256',
      },
    ],
  }
}
