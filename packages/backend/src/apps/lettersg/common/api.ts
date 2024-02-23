export enum LetterSgEnvironment {
  Staging = 'test',
  Prod = 'live',
}

const STAGING_ENV_API_KEY_PREFIX = 'test_'
const STAGING_ENV_BASE_URL = 'https://staging.letters.gov.sg/api'

// TODO (mal): test this when prod api is out
const PROD_ENV_API_KEY_PREFIX = 'live_'
const PROD_ENV_BASE_URL = 'https://letters.gov.sg/api'

export function getEnvironmentFromApiKey(apiKey: string): LetterSgEnvironment {
  if (apiKey.startsWith(PROD_ENV_API_KEY_PREFIX)) {
    return LetterSgEnvironment.Prod
  }

  if (apiKey.startsWith(STAGING_ENV_API_KEY_PREFIX)) {
    return LetterSgEnvironment.Staging
  }

  throw new Error('LetterSG API key has unrecognized prefix!')
}

export function getApiBaseUrl(apiKey: string): string {
  const env = getEnvironmentFromApiKey(apiKey)

  switch (env) {
    case LetterSgEnvironment.Prod:
      return PROD_ENV_BASE_URL
    case LetterSgEnvironment.Staging:
      return STAGING_ENV_BASE_URL
  }
}
