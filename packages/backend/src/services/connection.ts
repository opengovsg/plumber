import { Transaction } from 'objection'

import { ForbiddenError } from '@/errors/graphql-errors'
import App from '@/models/app'
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
    // TODO (kevinkim-ogp): phase 2 will allow editors to add their own connections, so owner's connections
    // will need to include connections from the flow_connections table

    return await Connection.query(trx)
      .findById(connectionId)
      .where(function () {
        // connection is either owned by the user
        this.where('connections.user_id', context.currentUser.id).orWhereExists(
          // or accessible via flow_connections table
          FlowConnections.query(trx)
            .whereColumn('flow_connections.connection_id', 'connections.id')
            .where('flow_connections.flow_id', flowId),
        )
      })
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

type GetOwnEditableConnectionParams = {
  context: Context
  connectionId: string
  trx?: Transaction
}

/**
 * Fetches a connection outside of any pipe, for the connections page's credential
 * editing. Only the user's own connections are reachable, and only for apps that
 * opted into editing via their auth's supportsConnectionEdit.
 */
export const getOwnEditableConnection = async (
  params: GetOwnEditableConnectionParams,
) => {
  const { context, connectionId, trx } = params

  const connection = await context.currentUser
    .$relatedQuery('connections', trx)
    .findById(connectionId)
    .throwIfNotFound({ message: 'Connection not found' })

  const app = await App.findOneByKey(connection.key)

  if (
    app.auth?.connectionType !== 'user-added' ||
    !app.auth.supportsConnectionEdit
  ) {
    throw new ForbiddenError('This connection cannot be edited')
  }

  return connection
}
