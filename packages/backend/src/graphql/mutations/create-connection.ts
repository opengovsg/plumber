import App from '@/models/app'
import Connection from '@/models/connection'
import FlowConnections from '@/models/flow-connections'

import type { MutationResolvers } from '../__generated__/types.generated'

// Sensitive graphql variables redacted in morgan.ts and datadog's Sensitive
// Data Scanner

const createConnection: MutationResolvers['createConnection'] = async (
  _parent,
  params,
  context,
) => {
  await App.findOneByKey(params.input.key)

  // The AI Builder creates connections before any pipe exists, so there is no
  // flowId to link — the connection is personal to the current user.
  if (!params.input.flowId) {
    return await Connection.query().insertAndFetch({
      key: params.input.key,
      formattedData: params.input.formattedData,
      verified: false,
      userId: context.currentUser.id,
    })
  }

  const flow = await context.currentUser
    .withAccessibleFlows({ requiredRole: 'editor' })
    .findOne({
      id: params.input.flowId,
    })
    .throwIfNotFound()

  const isCollaboratorAdded = flow.role === 'editor'

  const newConnection = await Connection.transaction(async (trx) => {
    const newConnection = await Connection.query(trx).insertAndFetch({
      key: params.input.key,
      formattedData: params.input.formattedData,
      verified: false,
      // Note: if this is a collaborator added connection, the userId is null
      // as it is a shared connection that belongs to a Pipe and not a specific user
      userId: isCollaboratorAdded ? null : context.currentUser.id,
    })

    /**
     * COLLABORATORS
     * If the flowId is provided and the flow has collaborators, we add this to the flow_connections table.
     * We add regardless of whether its a draft, so that it can be used by collaborators later.
     */
    await FlowConnections.addFlowConnection({
      flowId: params.input.flowId,
      connectionId: newConnection.id,
      addedBy: context.currentUser.id,
      connectionType: 'connection',
      trx,
    })

    return newConnection
  })

  return newConnection
}

export default createConnection
