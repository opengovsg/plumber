import appConfig from '@/config/app'
import * as URLS from '@/config/urls'

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

export async function generateAuthUrl({
  authorizeUrl,
  clientId,
  redirectUri,
  scopes,
}: {
  authorizeUrl: string
  clientId: string
  redirectUri: string
  scopes: string
}): Promise<{
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
  const authUrl =
    authorizeUrl +
    '?response_type=code' +
    '&code_challenge_method=S256' +
    `&code_challenge=${challenge}` +
    `&nonce=${nonce}` +
    `&client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(scopes)}` +
    stateQueryParamString

  return {
    url: authUrl,
    verifier,
    nonce,
  }
}

export const generateSsoAuthUrl = () =>
  generateAuthUrl({
    authorizeUrl: `${appConfig.ssoHostname}/api/oidc/authorize`,
    clientId: appConfig.ssoClientId,
    redirectUri: `${window.location.origin}${URLS.LOGIN_SSO_REDIRECT}`,
    scopes: 'openid email',
  })

export const generateSgidAuthUrl = () =>
  generateAuthUrl({
    authorizeUrl: 'https://api.id.gov.sg/v2/oauth/authorize',
    clientId: appConfig.sgidClientId,
    redirectUri: `${window.location.origin}${URLS.LOGIN_SGID_REDIRECT}`,
    scopes: 'openid pocdex.public_officer_details',
  })
