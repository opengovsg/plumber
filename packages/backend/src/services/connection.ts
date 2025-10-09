import { IFlowCollabRole } from '@plumber/types'

import { NotFoundError, Transaction } from 'objection'

import Context from '@/types/express/context'

type GetConnectionParams = {
  context: Context
  connectionId: string
  flowId: string
  requiredRole: IFlowCollabRole
  role?: IFlowCollabRole
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
 * NOTE: with the introduction of collaborators, we use this helper function to fetch the connection
 */
export const getConnection = async (params: GetConnectionParams) => {
  const { context, connectionId, role, trx, flowId } = params
  let userRole = role

  // flowId is only present within the editor, which means we should know the role.
  // the only time we would not know the role is when the connection is being added to the pipe
  // so we fetch the role from the flow
  if (flowId && !role) {
    const flow = await context.currentUser
      .withAccessibleFlows({ requiredRole: 'viewer', trx })
      .findOne({ 'flows.id': flowId })
      .throwIfNotFound({ message: 'Flow not found' })

    userRole = flow.role
  }

  // there are two scenarios where we can directly fetch the connection from the user
  // 1. when flowId is not present, which means the connection is being retrieved from the my apps page
  // 2. when the user is the owner of the pipe
  // TODO (kevinkim-ogp): phase 2 will allow editors to add their own connections, so owner's connections
  // will need to include connections from the flow_connections table
  if (!flowId || userRole === 'owner') {
    return context.currentUser
      .$relatedQuery('connections', trx)
      .findOne({ 'connections.id': connectionId })
      .throwIfNotFound({ message: 'Connection not found' })
  }

  /**
   * NOTE: editor and viewer can only access shared connections from the flow_connections table
   */
  const connection = getFlowConnection(params)
  if (!connection) {
    throw new NotFoundError({ message: 'Connection not found' })
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

  return flowConnection?.connection
}
