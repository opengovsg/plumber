import { IGlobalVariable } from '@plumber/types'

import logger from '@/helpers/logger'

import { parseDatabricksGeneration } from '../common/connection-generation'
import { createSession } from './create-client'
import { resolveDatabricksWorkspace } from './resolve-workspace' // pragma: allowlist secret

export async function checkSchemaExists($: IGlobalVariable): Promise<boolean> {
  // Open the session without an initialSchema; getSchemas() would fail against
  // a schema that doesn't exist yet.
  const generation = parseDatabricksGeneration($.auth.data?.generation)
  // oxfmt-ignore
  const credentials = resolveDatabricksWorkspace(generation) // pragma: allowlist secret
  const { session, endSession } = await createSession($, {
    skipSchema: true,
    generation,
  })

  try {
    const { screenName } = $.auth.data
    const schemaName = screenName as string
    if (!schemaName) {
      throw new Error('No connections found')
    }
    const operation = await session.getSchemas({
      catalogName: credentials.catalog,
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
