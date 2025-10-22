import { Transaction } from 'objection'

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
    // this means that the user is the owner of the pipe
    // it could be their own connection or a shared connection
    // TODO (kevinkim-ogp): phase 2 will allow editors to add their own connections, so owner's connections
    // will need to include connections from the flow_connections table
    return await context.currentUser
      .$relatedQuery('connections', trx)
      .findOne({ 'connections.id': connectionId })
      .throwIfNotFound({ message: 'Connection not found' })
  }

  // NOTE: editor and viewer can only access shared connections from the flow_connections table
  const flowConnection = await FlowConnections.query(trx)
    .findOne({
      connection_id: connectionId,
      flow_id: flowId,
    })
    .withGraphFetched('connection')
    .throwIfNotFound({ message: 'Connection not found' })

  return flowConnection?.connection
}
