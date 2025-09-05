import App from '@/models/app'
import FlowConnections from '@/models/flow-connections'

import type { QueryResolvers } from '../__generated__/types.generated'

const getApp: QueryResolvers['getApp'] = async (_parent, params, context) => {
  const app = await App.findOneByKey(params.key)

  if (!context.currentUser) {
    return app
  }

  if (app.auth?.connectionType === 'system-added') {
    const connections = await app.auth.getSystemAddedConnections(
      context.currentUser,
    )

    return {
      ...app,
      connections,
    }
  }

  if (app.auth?.connectionType === 'user-added') {
    // NOTE: only have flowId if the user is a collaborator
    if (params.flowId) {
      const flowConnections = await FlowConnections.withAccessible({
        userId: context.currentUser.id,
      })
        .withGraphJoined({
          connections: true,
        })
        .where({
          'flows.id': params.flowId,
          'connections.key': params.key,
          'connections.draft': false,
        })

      return {
        ...app,
        connections: flowConnections.map(
          (flowConnection) => flowConnection.connections,
        ),
      }
    }

    const connections = await context.currentUser
      .$relatedQuery('connections')
      .select('connections.*')
      .fullOuterJoinRelated('steps')
      .where({
        'connections.key': params.key,
        'connections.draft': false,
      })
      .countDistinct('steps.flow_id as flowCount')
      .groupBy('connections.id')
      .orderBy('created_at', 'desc')

    return {
      ...app,
      connections,
    }
  }

  return app
}

export default getApp
