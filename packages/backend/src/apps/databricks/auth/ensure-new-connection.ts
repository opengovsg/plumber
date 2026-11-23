import type { TransactionOrKnex } from 'objection'

import {
  databricksConfigSchema,
  readNewDatabricksConfig,
} from '@/config/app-env-vars/databricks'
import { getLdFlagValue } from '@/helpers/launch-darkly'
import logger from '@/helpers/logger'
import Connection from '@/models/connection'
import User from '@/models/user'

import { type DatabricksGeneration } from '../common/connection-generation'
import { APP_KEY } from '../common/constants'
import { constructSchemaNameFromEmail } from '../common/construct-schema-name'
import { resolveDatabricksCredentials } from './resolve-credentials'

const NEW_CONNECTION_FLAG = 'databricks-new-connection'

type WorkspacePointer = { serverHostname: string; catalog: string }

// Null keeps the user on the legacy workspace.
export async function newConnectionCredentials(userEmail: string) {
  if (!(await getLdFlagValue(NEW_CONNECTION_FLAG, userEmail, false))) {
    return null
  }
  const parsed = databricksConfigSchema.safeParse(readNewDatabricksConfig())
  if (!parsed.success) {
    logger.error('Databricks new credentials are missing')
    return null
  }
  return parsed.data
}

async function insertDatabricksConnection(
  user: User,
  generation: DatabricksGeneration,
  workspace: WorkspacePointer,
  trx: TransactionOrKnex,
): Promise<void> {
  await user.$relatedQuery('connections', trx).insert({
    key: APP_KEY,
    formattedData: {
      env: JSON.stringify({
        hostname: workspace.serverHostname,
        catalog: workspace.catalog,
      }),
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

// A user gets at most one new row. Only step configuration passes
// ensureDatabricksNew, so My Apps never adds a new row beside a legacy one.
export async function ensureDatabricksConnection(
  user: User,
  ensureDatabricksNew: boolean,
): Promise<boolean> {
  // LaunchDarkly init can wait without a timeout. That wait must not hold a pooled connection.
  const newCredentials = await newConnectionCredentials(user.email)
  const gateOn = newCredentials !== null
  // Two getApp calls can both see zero new rows and both insert one.
  return Connection.transaction(async (trx) => {
    await trx.raw('select pg_advisory_xact_lock(hashtext(?))', [
      `databricks:${user.id}`,
    ])
    const rows = await user
      .$relatedQuery('connections', trx)
      .where({ key: APP_KEY })

    if (!newCredentials) {
      if (rows.length === 0) {
        await insertDatabricksConnection(
          user,
          'legacy',
          resolveDatabricksCredentials('legacy'),
          trx,
        )
      }
      return gateOn
    }

    if (rows.some(isNewConnection)) {
      return gateOn
    }

    if (ensureDatabricksNew || rows.length === 0) {
      await insertDatabricksConnection(user, 'new', newCredentials, trx)
    }
    return gateOn
  })
}
