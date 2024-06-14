export enum PostmanEnv {
  Test = 'test',
  Prod = 'prod',
}

export const PROD_ENV_KEY_PREFIX = 'key_live_'
export const PROD_ENV_API_URL = 'https://postman.gov.sg/api/v2'

export const TEST_ENV_KEY_PREFIX = 'key_test_'
export const TEST_ENV_API_URL = 'https://test.postman.gov.sg/api/v2'
