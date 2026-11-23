import axios from 'axios'

import { createRedisClient, REDIS_DB_INDEX } from '@/config/redis'
import logger from '@/helpers/logger'

import { type DatabricksConnection } from './resolve-connection'

const redisClient = createRedisClient(REDIS_DB_INDEX.APP_DATA)

export async function getDatabricksToken({
  generation,
  credentials,
  tokenRedisKey,
}: DatabricksConnection): Promise<string> {
  try {
    const cachedToken = await redisClient.get(tokenRedisKey)
    if (cachedToken) {
      logger.info('Databricks OAuth token read', {
        event: 'databricks-oauth-token-read',
        generation,
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
      generation,
      accessToken: accessToken.slice(0, 10) + '...',
    })

    // expires_in is in seconds, minus 1 minute of buffer
    const expiresIn = response.data.expires_in - 60
    // Write it into Redis
    await redisClient.set(tokenRedisKey, accessToken, 'EX', expiresIn)

    return accessToken
  } catch (e) {
    logger.error('Databricks OAuth token read error', {
      event: 'databricks-oauth-token-read-error',
      generation,
      errorMessage: e instanceof Error ? e.message : undefined,
    })
    throw new Error('Failed to get Databricks OAuth token')
  }
}
