import { IGlobalVariable } from '@plumber/types'

import { databricksConfig } from '@/config/app-env-vars/databricks'
import logger from '@/helpers/logger'

import { createSession } from './create-client'

export async function checkSchemaExists($: IGlobalVariable): Promise<boolean> {
  // Open the session without an initialSchema; getSchemas() would fail against
  // a schema that doesn't exist yet.
  const { session, endSession } = await createSession($, { skipSchema: true })

  try {
    const { screenName } = $.auth.data
    const schemaName = screenName as string
    if (!schemaName) {
      throw new Error('No connections found')
    }
    const operation = await session.getSchemas({
      catalogName: databricksConfig.catalog,
      schemaName,
    })
    const schemas = await operation.fetchAll()
    return schemas.length > 0
  } catch (error) {
    logger.error('Failed to check schema existence in Databricks', {
      event: 'databricks-check-schema-error',
      error,
    })
    throw new Error('Failed to check schema existence in Databricks')
  } finally {
    await endSession()
  }
}
