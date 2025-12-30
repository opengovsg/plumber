// import OAuthPersistence from '@databricks/sql/dist/connection/auth/DatabricksOAuth/OAuthPersistence'
// import OAuthToken from '@databricks/sql/dist/connection/auth/DatabricksOAuth/OAuthToken'
import axios from 'axios'

import { databricksConfig } from '@/config/app-env-vars/databricks'
import { createRedisClient, REDIS_DB_INDEX } from '@/config/redis'
import logger from '@/helpers/logger'

const redisClient = createRedisClient(REDIS_DB_INDEX.APP_DATA)

const DATABRICKS_AUTH_TOKEN_REDIS_PREFIX = 'databricks:authToken:'

export async function getDatabricksToken(): Promise<string> {
  const redisKey =
    DATABRICKS_AUTH_TOKEN_REDIS_PREFIX + databricksConfig.serverHostname
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
        baseURL: `https:/${databricksConfig.serverHostname}`,
        auth: {
          username: databricksConfig.clientId,
          password: databricksConfig.clientSecret,
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

// class DatabricksOAuthPersistence implements OAuthPersistence {
//   async persist(host: string, token: OAuthToken): Promise<void> {
//     const redisKey = DATABRICKS_AUTH_TOKEN_REDIS_PREFIX + host
//     // token.expirationTime is in seconds, so convert Date.now() to seconds as well
//     const expiresIn = token.expirationTime - Math.floor(Date.now() / 1000)
//     try {
//       await redisClient.set(
//         DATABRICKS_AUTH_TOKEN_REDIS_PREFIX + host,
//         token.accessToken,
//         'EX', // expire in seconds
//         expiresIn,
//       )
//       logger.info('Databricks OAuth token persisted', {
//         event: 'databricks-oauth-token-persisted',
//         redisKey,
//         expiresIn,
//       })
//     } catch (e) {
//       logger.error('Databricks OAuth token persistence error', {
//         event: 'databricks-oauth-token-persistence-error',
//         error: e,
//         redisKey,
//       })
//       throw e
//     }
//   }
//   async read(host: string): Promise<OAuthToken | undefined> {
//     const redisKey = DATABRICKS_AUTH_TOKEN_REDIS_PREFIX + host

//     try {
//       const cachedToken = await redisClient.get(redisKey)
//       logger.info('Databricks OAuth token read', {
//         event: 'databricks-oauth-token-read',
//         redisKey,
//       })
//       if (!cachedToken) {
//         return undefined
//       }
//       return new OAuthToken(cachedToken)
//     } catch (e) {
//       logger.error('Databricks OAuth token read error', {
//         event: 'databricks-oauth-token-read-error',
//         error: e,
//         redisKey,
//       })
//       throw e
//     }
//   }
// }

// export const databricksOAuthPersistence = new DatabricksOAuthPersistence()
