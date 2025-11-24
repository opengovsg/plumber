import FlowConnections from '@/models/flow-connections'

import type { MutationResolvers } from '../__generated__/types.generated'

const deleteConnection: MutationResolvers['deleteConnection'] = async (
  _parent,
  params,
  context,
) => {
  await context.currentUser
    .$relatedQuery('connections')
    .delete()
    .findOne({
      id: params.input.id,
    })
    .throwIfNotFound()

  // also delete the connection from the flow_connections table for flows with collaborators
  await FlowConnections.query()
    .delete()
    .where({ connection_id: params.input.id })

  return true
}

export default deleteConnection
