const STAGING_PREFIX = 'paysg_stag_'
const STAGING_BASE_URL = 'https://api-staging.pay.gov.sg'

const LIVE_PREFIX = 'paysg_live_'
const LIVE_BASE_URL = 'https://api.pay.gov.sg'

export default function getApiBaseUrl(apiKey: string): string {
  if (apiKey.startsWith(LIVE_PREFIX)) {
    return LIVE_BASE_URL
  }

  if (apiKey.startsWith(STAGING_PREFIX)) {
    return STAGING_BASE_URL
  }

  throw new Error('API key has unrecognized prefix!')
}
