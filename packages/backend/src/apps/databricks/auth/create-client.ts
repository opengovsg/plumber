import { DBSQLClient, LogLevel } from '@databricks/sql'
import IDBSQLClient, {
  ConnectionOptions,
} from '@databricks/sql/dist/contracts/IDBSQLClient'
import { IGlobalVariable } from '@plumber/types'

import { databricksConfig } from '@/config/app-env-vars/databricks'
import logger from '@/helpers/logger'

import { constructSchemaName } from '../common/construct-schema-name'
import { getDatabricksToken } from './token-persistence'

interface CreateSessionOptions {
  skipSchema?: boolean
}

export const createSession = async (
  $: IGlobalVariable,
  options?: CreateSessionOptions,
) => {
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

  const token = await getDatabricksToken()
  const connectOptions = {
    authType: 'access-token',
    host: databricksConfig.serverHostname,
    path: databricksConfig.httpPath,
    token,
  } satisfies ConnectionOptions

  let connectedClient: IDBSQLClient
  try {
    connectedClient = await client.connect(connectOptions)
    const session = await connectedClient.openSession({
      initialSchema: options?.skipSchema ? undefined : constructSchemaName($),
      initialCatalog: databricksConfig.catalog,
    })
    const endSession = async () => {
      try {
        await session.close()
        await connectedClient.close()
      } catch (e) {
        logger.warn('Unable to close session', e)
      }
    }

    return { session, endSession }
  } catch (error) {
    // Clean up the connected client if it was created
    if (connectedClient) {
      await connectedClient.close().catch(() => {})
    }
    logger.error('Failed to connect to Databricks', {
      event: 'databricks-connect-error',
      error,
    })
    throw new Error('Failed to connect to Databricks')
  }
}
