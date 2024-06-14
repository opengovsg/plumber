import { IGlobalVariable } from '@plumber/types'

import { authDataSchema } from '../auth/schema'

import {
  PostmanEnv,
  PROD_ENV_KEY_PREFIX,
  TEST_ENV_KEY_PREFIX,
} from './constants'

export default function getPostmanEnv($: IGlobalVariable): PostmanEnv {
  const { apiKey } = authDataSchema.parse($.auth.data)

  if (apiKey.startsWith(PROD_ENV_KEY_PREFIX)) {
    return PostmanEnv.Prod
  }
  if (apiKey.startsWith(TEST_ENV_KEY_PREFIX)) {
    return PostmanEnv.Test
  }

  throw new Error('Unsupported postman environment')
}
