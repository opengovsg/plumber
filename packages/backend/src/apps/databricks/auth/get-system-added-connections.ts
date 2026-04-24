import type { ISystemAddedConnectionAuth } from '@plumber/types'

import { databricksConfig } from '@/config/app-env-vars/databricks'
import User from '@/models/user'

import { APP_KEY } from '../common/constants'
import { constructSchemaNameFromEmail } from '../common/construct-schema-name'

const getSystemAddedConnections: NonNullable<
  ISystemAddedConnectionAuth['getSystemAddedConnections']
> = async function (user) {
  if (!(user instanceof User)) {
    throw new Error(
      'Invalid user object received by Databricks getSystemAddedConnections',
    )
  }

  const connections = await user
    .$relatedQuery('connections')
    .select('connections.*')
    .fullOuterJoinRelated('steps')
    .where({
      'connections.key': APP_KEY,
    })
    .countDistinct('steps.flow_id as flowCount')
    .groupBy('connections.id')
    .orderBy('created_at', 'desc')

  if (connections.length === 0) {
    const newConnection = await user
      .$relatedQuery('connections')
      .insertAndFetch({
        key: APP_KEY,
        formattedData: {
          // Workspace hostname drives the "View workspace" link in the UI.
          env: databricksConfig.serverHostname,
          screenName: constructSchemaNameFromEmail(user.email),
        },
        verified: false,
        draft: false,
      })
      .returning('*')

    newConnection.flowCount = 0
    connections.push(newConnection)
  }

  return connections
}

export default getSystemAddedConnections
