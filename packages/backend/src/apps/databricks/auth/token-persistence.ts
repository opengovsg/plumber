import axios from 'axios'

import { createRedisClient, REDIS_DB_INDEX } from '@/config/redis'
import logger from '@/helpers/logger'

import { type DatabricksGeneration } from '../common/connection-generation'
import { resolveDatabricksWorkspace } from './resolve-workspace' // pragma: allowlist secret

const redisClient = createRedisClient(REDIS_DB_INDEX.APP_DATA)

const DATABRICKS_AUTH_TOKEN_REDIS_PREFIX = 'databricks:authToken:'

export async function getDatabricksToken(
  generation: DatabricksGeneration,
): Promise<string> {
  // oxfmt-ignore
  const credentials = resolveDatabricksWorkspace(generation) // pragma: allowlist secret
  const redisKey =
    DATABRICKS_AUTH_TOKEN_REDIS_PREFIX + credentials.serverHostname
  try {
    const cachedToken = await redisClient.get(redisKey)
    if (cachedToken) {
      logger.info('Databricks OAuth token read', {
        event: 'databricks-oauth-token-read',
        redisKey,
      })
      return cachedToken
    }

    const response = await axios.post(
      '/oidc/v1/token',
      new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'all-apis',
      }),
      {
        baseURL: `https://${credentials.serverHostname}`,
        auth: {
          username: credentials.clientId,
          password: credentials.clientSecret,
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    )
    const accessToken = response.data.access_token
    logger.info('Databricks OAuth token response', {
      event: 'databricks-oauth-token-response',
      redisKey,
      accessToken: accessToken.slice(0, 10) + '...',
    })

    // expires_in is in seconds, minus 1 minute of buffer
    const expiresIn = response.data.expires_in - 60
    // Write it into Redis
    await redisClient.set(redisKey, accessToken, 'EX', expiresIn)

    return accessToken
  } catch (e) {
    logger.error('Databricks OAuth token read error', {
      event: 'databricks-oauth-token-read-error',
      error: e,
      redisKey,
    })
    throw new Error('Failed to get Databricks OAuth token')
  }
}
