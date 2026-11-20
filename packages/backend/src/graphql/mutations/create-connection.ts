import { BadUserInputError } from '@/errors/graphql-errors'
import App from '@/models/app'
import Connection from '@/models/connection'
import FlowConnections from '@/models/flow-connections'

import type { MutationResolvers } from '../__generated__/types.generated'

// Sensitive graphql variables redacted in morgan.ts and datadog's Sensitive
// Data Scanner

const createConnection: NonNullable<
  MutationResolvers['createConnection']
> = async (_parent, params, context) => {
  const { input } = params
  if (!input) {
    throw new BadUserInputError('Missing input')
  }

  await App.findOneByKey(input.key)

  const flow = await context.currentUser
    .withAccessibleFlows({ requiredRole: 'editor' })
    .findOne({
      id: input.flowId,
    })
    .throwIfNotFound()

  const isCollaboratorAdded = flow.role === 'editor'

  const newConnection = await Connection.transaction(async (trx) => {
    const newConnection = await Connection.query(trx).insertAndFetch({
      key: input.key,
      formattedData: input.formattedData,
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
      flowId: input.flowId,
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
