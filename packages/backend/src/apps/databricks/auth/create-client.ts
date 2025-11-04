import { IGlobalVariable } from '@plumber/types'

import { DBSQLClient, LogLevel } from '@databricks/sql'

import { databricksConfig } from '@/config/app-env-vars/databricks'
import logger from '@/helpers/logger'

export const createSession = async ($: IGlobalVariable) => {
  const token = $.auth.data.token
  if (typeof token !== 'string') {
    throw new Error('Databricks personal access token is required')
  }

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

  const connectOptions = {
    token,
    host: databricksConfig.serverHostname,
    path: databricksConfig.httpPath,
    userAgent: 'plumber',
  }

  try {
    const connectedClient = await client.connect(connectOptions)
    const session = await connectedClient.openSession({
      initialSchema: $.auth.data.schema as string,
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
