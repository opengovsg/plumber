import { IFlowCollabRole } from '@plumber/types'

import { Transaction } from 'objection'

import { BadUserInputError } from '@/errors/graphql-errors'
import Context from '@/types/express/context'

type GetConnectionParams = {
  context: Context
  connectionId: string
  flowId: string
  requiredRole: IFlowCollabRole
  trx?: Transaction
}

type GetFlowConnectionParams = {
  context: Context
  connectionId: string
  flowId: string
  requiredRole: IFlowCollabRole
  trx?: Transaction
}

/**
 * NOTE: with the introduction of collaborators, we first look for the
 * connection in the flow_connections table as this would contain all the
 * connections that have been shared within a pipe.
 *
 * However, there may be connections that have not been shared yet
 * (e.g., when the owner is adding a new connection to the pipe) so
 * we need to fallback to the direct connection method.
 */
export const getConnection = async (params: GetConnectionParams) => {
  const { context, connectionId, requiredRole, trx } = params
  let connection

  const flowConnection = await getFlowConnection(params)

  if (flowConnection) {
    // shared connection
    connection = flowConnection.connection
  } else {
    // connection has not been shared yet
    connection = await context.currentUser
      .withAccessibleConnections({ requiredRole, trx })
      .findOne({ 'connections.id': connectionId })
  }

  if (!connection) {
    throw new BadUserInputError('Connection not found')
  }

  return connection
}

/**
 * Gets the connection that has been shared to the flow from the
 * flow_connections table.
 */
export const getFlowConnection = async ({
  context,
  connectionId,
  flowId,
  requiredRole,
  trx,
}: GetFlowConnectionParams) => {
  const flowConnection = await context.currentUser
    .withAccessibleFlowConnections({
      requiredRole,
      trx,
    })
    .withGraphFetched('connection')
    .findOne({
      'flow_connections.connection_id': connectionId,
      'flow_connections.flow_id': flowId ?? null,
    })

  return flowConnection
}
