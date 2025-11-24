import { Transaction } from 'objection'

import Connection from '@/models/connection'
import FlowConnections from '@/models/flow-connections'
import Context from '@/types/express/context'

type GetConnectionParams = {
  context: Context
  connectionId: string
  flowId: string
  includeOwnConnections?: boolean
  trx?: Transaction
}

/**
 * NOTE: with the introduction of collaborators, we use this helper function to fetch the connection
 * we do not need to check the user's role again here as the role would have been checked
 * before this function is called
 */
export const getConnection = async (params: GetConnectionParams) => {
  const { context, connectionId, includeOwnConnections, trx, flowId } = params

  if (includeOwnConnections) {
    // there are 2 types of connections that an owner can access:
    // 1. the user is the owner of the pipe
    //    it could be their own connection or a shared connection
    // 2. the user is the owner of a pipe that has been transferred to them
    //    it should include connections from the flow_connections table as well
    //
    // NOTE: if the connection was deleted, we don't want to throw an error,
    // we just want to return null so we can show 'Not connected'
    //
    // TODO (kevinkim-ogp): phase 2 will allow editors to add their own connections, so owner's connections
    // will need to include connections from the flow_connections table

    const connection = await Connection.query(trx)
      .findById(connectionId)
      .where(function () {
        // connection is either owned by the user
        this.where('connections.user_id', context.currentUser.id).orWhereExists(
          // or accessible via flow_connections table
          FlowConnections.query(trx)
            .withSoftDeleted()
            .whereColumn('flow_connections.connection_id', 'connections.id')
            .where('flow_connections.flow_id', flowId),
        )
      })
      .throwIfNotFound({ message: 'Connection not found' })

    if (connection?.deletedAt) {
      return null
    }

    return connection
  }

  // NOTE: editor and viewer can only access shared connections from the flow_connections table
  const flowConnection = await FlowConnections.query(trx)
    .withSoftDeleted()
    .findOne({
      connection_id: connectionId,
      flow_id: flowId,
    })
    .withGraphFetched('connection')
    .throwIfNotFound({ message: 'Connection not found' })

  if (flowConnection?.deletedAt) {
    return null
  }

  return flowConnection?.connection
}
