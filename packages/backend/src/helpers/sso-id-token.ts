const REQUIRED_CLAIMS = ['iss', 'sub', 'aud', 'exp', 'iat', 'nonce'] as const

export type VerifiedSsoClaims = {
  sub: string
  email?: string
  sid?: string
}

export function assertVerifiedIdTokenClaims({
  claims,
  issuer,
  clientId,
  nonce,
}: {
  claims: Record<string, unknown>
  issuer: string
  clientId: string
  nonce: string
}): VerifiedSsoClaims {
  for (const claim of REQUIRED_CLAIMS) {
    if (claims[claim] === undefined || claims[claim] === null) {
      throw new Error('SSO id_token is missing a required claim')
    }
  }

  if (claims.iss !== issuer) {
    throw new Error('SSO id_token issuer mismatch')
  }

  const audience = claims.aud
  const audienceOk =
    audience === clientId ||
    (Array.isArray(audience) &&
      audience.length === 1 &&
      audience[0] === clientId)
  if (!audienceOk) {
    throw new Error('SSO id_token audience mismatch')
  }

  if (claims.azp !== undefined && claims.azp !== clientId) {
    throw new Error('SSO id_token authorized party mismatch')
  }

  if (claims.nonce !== nonce) {
    throw new Error('SSO id_token nonce mismatch')
  }

  if (typeof claims.sub !== 'string' || claims.sub.length === 0) {
    throw new Error('SSO id_token subject is invalid')
  }

  return {
    sub: claims.sub,
    email: typeof claims.email === 'string' ? claims.email : undefined,
    sid: typeof claims.sid === 'string' ? claims.sid : undefined,
  }
}
