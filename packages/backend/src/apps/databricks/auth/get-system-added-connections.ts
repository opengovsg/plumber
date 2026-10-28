import type { ISystemAddedConnectionAuth } from '@plumber/types'

import User from '@/models/user'

import { APP_KEY } from '../common/constants'
import { ensureDatabricksConnection } from './ensure-new-connection'

const getSystemAddedConnections: NonNullable<
  ISystemAddedConnectionAuth['getSystemAddedConnections']
> = async function (user) {
  if (!(user instanceof User)) {
    throw new Error(
      'Invalid user object received by Databricks getSystemAddedConnections',
    )
  }

  await ensureDatabricksConnection(user, false)

  return user
    .$relatedQuery('connections')
    .select('connections.*')
    .fullOuterJoinRelated('steps')
    .where({
      'connections.key': APP_KEY,
    })
    .countDistinct('steps.flow_id as flowCount')
    .groupBy('connections.id')
    .orderBy('created_at', 'desc')
}

export default getSystemAddedConnections
