export enum PaySgEnvironment {
  Staging,
  Live,
}

const STAGING_ENV_API_KEY_PREFIX = 'paysg_stag_'
const STAGING_ENV_BASE_URL = 'https://api-staging.pay.gov.sg'

const LIVE_ENV_API_KEY_PREFIX = 'paysg_live_'
const LIVE_ENV_BASE_URL = 'https://api.pay.gov.sg'

export function getEnvironmentFromApiKey(apiKey: string): PaySgEnvironment {
  if (apiKey.startsWith(LIVE_ENV_API_KEY_PREFIX)) {
    return PaySgEnvironment.Live
  }

  if (apiKey.startsWith(STAGING_ENV_API_KEY_PREFIX)) {
    return PaySgEnvironment.Staging
  }

  throw new Error('API key has unrecognized prefix!')
}

export function getApiBaseUrl(apiKey: string): string {
  const env = getEnvironmentFromApiKey(apiKey)

  switch (env) {
    case PaySgEnvironment.Live:
      return LIVE_ENV_BASE_URL
    case PaySgEnvironment.Staging:
      return STAGING_ENV_BASE_URL
  }
}
