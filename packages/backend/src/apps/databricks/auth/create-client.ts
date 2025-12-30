import { IGlobalVariable } from '@plumber/types'

import { DBSQLClient, LogLevel } from '@databricks/sql'
import { ConnectionOptions } from '@databricks/sql/dist/contracts/IDBSQLClient'

import { databricksConfig } from '@/config/app-env-vars/databricks'
import logger from '@/helpers/logger'

import { constructSchemaName } from '../common/construct-schema-name'

import { getDatabricksToken } from './token-persistence'

export const createSession = async ($: IGlobalVariable) => {
  const client: DBSQLClient = new DBSQLClient({
    logger: {
      log(level: LogLevel, message: string) {
        logger[level]({
          userId: $.user?.id,
          stepId: $.step?.id,
          flowId: $.flow?.id,
          testRun: $.execution?.testRun,
          event: 'databricks-client-log',
          message,
        })
      },
    },
  })

  // const connectOptions = {
  //   authType: 'databricks-oauth',
  //   oauthClientId: databricksConfig.clientId,
  //   oauthClientSecret: databricksConfig.clientSecret,
  //   host: databricksConfig.serverHostname,
  //   path: databricksConfig.httpPath,
  //   persistence: databricksOAuthPersistence,
  // } satisfies ConnectionOptions

  const token = await getDatabricksToken()
  const connectOptions = {
    authType: 'access-token',
    host: databricksConfig.serverHostname,
    path: databricksConfig.httpPath,
    token,
  } satisfies ConnectionOptions

  const schemaName = constructSchemaName($)

  try {
    const connectedClient = await client.connect(connectOptions)
    const session = await connectedClient.openSession({
      initialSchema: schemaName,
      initialCatalog: databricksConfig.catalog,
    })
    const endSession = async () => {
      await session.close()
      await connectedClient.close()
    }

    return { session, endSession }
  } catch (error) {
    throw new Error('Failed to connect to Databricks')
  }
}
