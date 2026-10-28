import {
  databricksConfigSchema,
  readNewDatabricksConfig,
} from '@/config/app-env-vars/databricks'
import logger from '@/helpers/logger'
import Connection from '@/models/connection'
import User from '@/models/user'

import {
  type DatabricksGeneration,
  parseDatabricksGeneration,
} from '../common/connection-generation'
import { APP_KEY } from '../common/constants'
import { constructSchemaNameFromEmail } from '../common/construct-schema-name'
import { resolveDatabricksWorkspace } from './resolve-workspace' // pragma: allowlist secret

const NEW_CONNECTION_FLAG = 'databricks-new-connection'
const NEW_CONNECTION_ENV = 'DATABRICKS_NEW_CONNECTION_ENABLED'

function newCredentialsAreConfigured(): boolean {
  const parsed = databricksConfigSchema.safeParse(readNewDatabricksConfig())
  if (parsed.success) {
    return true
  }
  logger.error('Databricks new credentials are missing')
  return false
}

export async function isDatabricksNewEnabled(
  userEmail: string,
): Promise<boolean> {
  const override = process.env[NEW_CONNECTION_ENV]
  if (override === 'false') {
    return false
  }

  const requested =
    override === 'true' ||
    (await (
      await import('@/helpers/launch-darkly')
    ).getLdFlagValue(NEW_CONNECTION_FLAG, userEmail, false))

  if (!requested) {
    return false
  }

  return newCredentialsAreConfigured()
}

function connectionEnv(generation: DatabricksGeneration): string {
  // oxfmt-ignore
  const credentials = resolveDatabricksWorkspace(generation) // pragma: allowlist secret
  return JSON.stringify({
    hostname: credentials.serverHostname,
    catalog: credentials.catalog,
  })
}

async function insertDatabricksConnection(
  user: User,
  generation: DatabricksGeneration,
): Promise<void> {
  await user.$relatedQuery('connections').insert({
    key: APP_KEY,
    formattedData: {
      env: connectionEnv(generation),
      screenName: constructSchemaNameFromEmail(user.email),
      generation,
    },
    verified: false,
    draft: false,
  })
}

function isNewConnection(connection: Connection): boolean {
  return (
    parseDatabricksGeneration(connection.formattedData?.generation) === 'new'
  )
}

// The first Databricks row follows the gate. ensureDatabricksNew only adds a
// new row beside an existing legacy row.
export async function ensureDatabricksConnection(
  user: User,
  ensureDatabricksNew: boolean,
): Promise<void> {
  const gateOn = await isDatabricksNewEnabled(user.email)
  const rows = await user.$relatedQuery('connections').where({ key: APP_KEY })

  if (!gateOn) {
    if (rows.length === 0) {
      await insertDatabricksConnection(user, 'legacy')
    }
    return
  }

  if (rows.some(isNewConnection)) {
    return
  }

  if (ensureDatabricksNew || rows.length === 0) {
    await insertDatabricksConnection(user, 'new')
  }
}
