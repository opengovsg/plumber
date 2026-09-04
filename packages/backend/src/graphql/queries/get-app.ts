import App from '@/models/app'
import Connection from '@/models/connection'
import Context from '@/types/express/context'

import type { QueryResolvers } from '../__generated__/types.generated'

const getSharedConnections = async (
  context: Context,
  flowId: string,
  key: string,
  isDraft: boolean,
) => {
  const flow = await context.currentUser
    .withAccessibleFlows({ requiredRole: 'viewer' })
    .findById(flowId)
    .throwIfNotFound({ message: 'Pipe not found' })

  const flowConnections = await context.currentUser
    .withAccessibleFlowConnections({ requiredRole: 'viewer' })
    .join('connections', 'connections.id', 'flow_connections.connection_id')
    .withGraphFetched('connection')
    .where({
      'flows.id': flowId,
      'connections.key': key,
      'connections.draft': isDraft,
    })

  if (flowConnections.length === 0) {
    return {
      flowRole: flow.role,
      sharedConnections: [],
    }
  }

  return {
    flowRole: flow.role,
    sharedConnections: flowConnections
      // in the rare case that the connection was deleted or not found
      // flowConnection.connection is null, which will throw error
      // when we attempt to assign the description
      .filter((flowConnection) => flowConnection?.connection)
      .map((flowConnection) =>
        Object.assign(flowConnection?.connection, {
          description: 'This connection can only be used in this pipe.',
        }),
      ),
  }
}

const getApp: QueryResolvers['getApp'] = async (_parent, params, context) => {
  const { flowId, key } = params
  const app = await App.findOneByKey(key)

  if (!context.currentUser) {
    return app
  }

  if (app.auth?.connectionType === 'system-added') {
    /**
     * NOTE: flow id is only provided in the pipe editor.
     * it is not provided at the 'My Apps' page, so no need to fetch shared connections
     */
    if (flowId) {
      const { sharedConnections, flowRole } = await getSharedConnections(
        context,
        flowId,
        key,
        true,
      )

      if (flowRole === 'editor') {
        return { ...app, connections: sharedConnections }
      }
    }

    const connections = await app.auth.getSystemAddedConnections(
      context.currentUser,
    )

    // NOTE: we don't merge the connections as only one system-added connection is allowed in a Pipe.
    // for example, you cannot use two different Excel connections in one Pipe.
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
      const { sharedConnections: sharedConnectionsFromFlow, flowRole } =
        await getSharedConnections(context, flowId, key, false)

      sharedConnections = sharedConnectionsFromFlow

      if (flowRole === 'editor') {
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
      [...sharedConnections, ...connections].reduce(
        (acc, obj) => {
          acc[obj.id] = obj // last one wins
          return acc
        },
        {} as Record<string, Connection>,
      ),
    )

    return {
      ...app,
      connections: mergedConnections,
    }
  }

  return app
}

export default getApp
