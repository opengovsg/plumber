import { IGlobalVariable } from '@plumber/types'

import { parseDatabricksGeneration } from '../common/connection-generation'
import { databricksAuthTokenRedisKey } from './auth-token-redis-key'
import { resolveDatabricksCredentials } from './resolve-credentials'

export type DatabricksConnection = ReturnType<
  typeof resolveDatabricksConnection
>

export function resolveDatabricksConnection($: IGlobalVariable) {
  const generation = parseDatabricksGeneration($.auth.data?.generation)
  const credentials = resolveDatabricksCredentials(generation)
  return {
    generation,
    credentials,
    tokenRedisKey: databricksAuthTokenRedisKey(credentials),
  }
}
