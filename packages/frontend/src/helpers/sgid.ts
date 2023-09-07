import * as URLS from 'config/urls'

// FIXME (ogp-weeloong): Add prod client ID later.
const CLIENT_ID = 'PLUMBERSTAGINGDEV-f49a9cb6'
const SCOPE = 'openid myinfo.name pocdex.public_officer_employments'
const REDIRECT_URL = `${window.location.origin}${URLS.LOGIN_SGID_REDIRECT}`
const PKCE_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'

function randomInt(limit: number): number {
  // Avoid mod bias with rejection sampling. Is a bit slow but should be OK for
  // PKCE length.
  for (;;) {
    const val = crypto.getRandomValues(new Uint8Array(1))[0]
    if (val < limit) {
      return val
    }
  }
}

async function generatePkceStuff(): Promise<{
  challenge: string
  verifier: string
  nonce: string
}> {
  // Max length just to feel good.
  const verifier = [...new Array(128)]
    .map((_) => PKCE_ALPHABET[randomInt(PKCE_ALPHABET.length)])
    .join('')

  const verifierDigest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)),
  )
  const challenge = btoa(String.fromCharCode(...verifierDigest))
    .replaceAll('/', '_')
    .replaceAll('+', '-')
    .replaceAll('=', '')

  const nonce = crypto.randomUUID()

  return {
    challenge,
    verifier,
    nonce,
  }
}

export async function buildSgidAuthCodeUrl(): Promise<{
  url: string
  verifier: string
  nonce: string
}> {
  const { challenge, verifier, nonce } = await generatePkceStuff()
  const sgidUrl =
    'https://api.id.gov.sg/v2/oauth/authorize?' +
    'response_type=code' +
    '&code_challenge_method=S256' +
    `&code_challenge=${challenge}` +
    `&nonce=${nonce}` +
    `&client_id=${CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URL)}` +
    `&scope=${encodeURIComponent(SCOPE)}`

  return {
    url: sgidUrl,
    verifier,
    nonce,
  }
}
