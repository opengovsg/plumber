import type { TransactionOrKnex } from 'objection'

import {
  databricksConfigSchema,
  readNewDatabricksConfig,
} from '@/config/app-env-vars/databricks'
import logger from '@/helpers/logger'
import Connection from '@/models/connection'
import User from '@/models/user'

import { type DatabricksGeneration } from '../common/connection-generation'
import { APP_KEY } from '../common/constants'
import { constructSchemaNameFromEmail } from '../common/construct-schema-name'
import { resolveDatabricksCredentials } from './resolve-credentials'

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

function forceNewConnection(): boolean {
  if (process.env[NEW_CONNECTION_ENV] !== 'true') {
    return false
  }
  // Production targeting stays on the LaunchDarkly flag.
  return process.env.APP_ENV !== 'prod'
}

export async function isDatabricksNewEnabled(
  userEmail: string,
): Promise<boolean> {
  const override = process.env[NEW_CONNECTION_ENV]
  if (override === 'false') {
    return false
  }

  const requested =
    forceNewConnection() ||
    (await (
      await import('@/helpers/launch-darkly')
    ).getLdFlagValue(NEW_CONNECTION_FLAG, userEmail, false))

  if (!requested) {
    return false
  }

  return newCredentialsAreConfigured()
}

function connectionEnv(generation: DatabricksGeneration): string {
  const credentials = resolveDatabricksCredentials(generation)
  return JSON.stringify({
    hostname: credentials.serverHostname,
    catalog: credentials.catalog,
  })
}

async function insertDatabricksConnection(
  user: User,
  generation: DatabricksGeneration,
  trx: TransactionOrKnex,
): Promise<void> {
  await user.$relatedQuery('connections', trx).insert({
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
  return connection.formattedData?.generation === 'new'
}

// The first Databricks row follows the gate. ensureDatabricksNew only adds a
// new row beside an existing legacy row.
export async function ensureDatabricksConnection(
  user: User,
  ensureDatabricksNew: boolean,
): Promise<boolean> {
  // LaunchDarkly init can wait without a timeout. That wait must not hold a pooled connection.
  const gateOn = await isDatabricksNewEnabled(user.email)
  // Two getApp calls can both see zero new rows and both insert one.
  return Connection.transaction(async (trx) => {
    await trx.raw('select pg_advisory_xact_lock(hashtext(?))', [
      `databricks:${user.id}`,
    ])
    const rows = await user
      .$relatedQuery('connections', trx)
      .where({ key: APP_KEY })

    if (!gateOn) {
      if (rows.length === 0) {
        await insertDatabricksConnection(user, 'legacy', trx)
      }
      return gateOn
    }

    if (rows.some(isNewConnection)) {
      return gateOn
    }

    if (ensureDatabricksNew || rows.length === 0) {
      await insertDatabricksConnection(user, 'new', trx)
    }
    return gateOn
  })
}
