import appConfig from 'config/app'
import * as URLS from 'config/urls'

const SCOPE = 'openid pocdex.public_officer_details'
const REDIRECT_URL = `${window.location.origin}${URLS.LOGIN_SGID_REDIRECT}`

async function generatePkceAndNonce(): Promise<{
  challenge: string
  verifier: string
  nonce: string
}> {
  const verifier = `${crypto.randomUUID()}~${crypto.randomUUID()}~${crypto.randomUUID()}`

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

export async function generateSgidAuthUrl(): Promise<{
  url: string
  verifier: string
  nonce: string
}> {
  const redirectQueryParam = new URLSearchParams(window.location.search).get(
    'redirect',
  )
  const stateQueryParamString = redirectQueryParam
    ? `&state=${encodeURIComponent(redirectQueryParam)}`
    : ''
  const { challenge, verifier, nonce } = await generatePkceAndNonce()
  const sgidUrl =
    'https://api.id.gov.sg/v2/oauth/authorize?' +
    'response_type=code' +
    '&code_challenge_method=S256' +
    `&code_challenge=${challenge}` +
    `&nonce=${nonce}` +
    `&client_id=${appConfig.sgidClientId}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URL)}` +
    `&scope=${encodeURIComponent(SCOPE)}` +
    stateQueryParamString

  return {
    url: sgidUrl,
    verifier,
    nonce,
  }
}
