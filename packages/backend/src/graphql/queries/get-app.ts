import App from '@/models/app'
import Connection from '@/models/connection'

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
    let sharedConnections: Connection[] = []
    /**
     * NOTE: flow id is only provided in the pipe editor.
     * it is not provided at the 'My Apps' page, so no need to fetch shared connections
     */

    if (params.flowId) {
      const flow = await context.currentUser
        .withAccessibleFlows({ requiredRole: 'viewer' })
        .findById(params.flowId)
        .throwIfNotFound({ message: 'Pipe not found' })

      const flowConnections = await context.currentUser
        .withAccessibleFlowConnections({ requiredRole: 'viewer' })
        .join('connections', 'connections.id', 'flow_connections.connection_id')
        .withGraphFetched('connection')
        .where({
          'flows.id': params.flowId,
          'connections.key': params.key,
          'connections.draft': false,
        })

      sharedConnections = flowConnections.map((flowConnection) =>
        Object.assign(flowConnection.connection, {
          description: 'This connection can only be used in this pipe.',
        }),
      )

      if (flow.role === 'editor') {
        return {
          ...app,
          connections: sharedConnections,
        }
      }
    }

    // if user is an owner, fetch all the connections
    // if the user is an owner, fetch all the connections that the user owns
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

    const mergedConnections = Object.values(
      [...sharedConnections, ...connections].reduce((acc, obj) => {
        acc[obj.id] = obj // last one wins
        return acc
      }, {} as Record<string, Connection>),
    )

    return {
      ...app,
      connections: mergedConnections,
    }
  }

  return app
}

export default getApp
