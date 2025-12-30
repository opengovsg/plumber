import OAuthPersistence from '@databricks/sql/dist/connection/auth/DatabricksOAuth/OAuthPersistence'
import OAuthToken from '@databricks/sql/dist/connection/auth/DatabricksOAuth/OAuthToken'

import { createRedisClient, REDIS_DB_INDEX } from '@/config/redis'
import logger from '@/helpers/logger'

const redisClient = createRedisClient(REDIS_DB_INDEX.APP_DATA)

const DATABRICKS_AUTH_TOKEN_REDIS_PREFIX = 'databricks:authToken:'

class DatabricksOAuthPersistence implements OAuthPersistence {
  async persist(host: string, token: OAuthToken): Promise<void> {
    const redisKey = DATABRICKS_AUTH_TOKEN_REDIS_PREFIX + host
    // token.expirationTime is in seconds, so convert Date.now() to seconds as well
    const expiresIn = token.expirationTime - Math.floor(Date.now() / 1000)
    try {
      await redisClient.set(
        DATABRICKS_AUTH_TOKEN_REDIS_PREFIX + host,
        token.accessToken,
        'EX', // expire in seconds
        expiresIn,
      )
      logger.info('Databricks OAuth token persisted', {
        event: 'databricks-oauth-token-persisted',
        redisKey,
        expiresIn,
      })
    } catch (e) {
      logger.error('Databricks OAuth token persistence error', {
        event: 'databricks-oauth-token-persistence-error',
        error: e,
        redisKey,
      })
      throw e
    }
  }
  async read(host: string): Promise<OAuthToken | undefined> {
    const redisKey = DATABRICKS_AUTH_TOKEN_REDIS_PREFIX + host

    try {
      const cachedToken = await redisClient.get(redisKey)
      logger.info('Databricks OAuth token read', {
        event: 'databricks-oauth-token-read',
        redisKey,
      })
      if (!cachedToken) {
        return undefined
      }
      return new OAuthToken(cachedToken)
    } catch (e) {
      logger.error('Databricks OAuth token read error', {
        event: 'databricks-oauth-token-read-error',
        error: e,
        redisKey,
      })
      throw e
    }
  }
}

export const databricksOAuthPersistence = new DatabricksOAuthPersistence()
