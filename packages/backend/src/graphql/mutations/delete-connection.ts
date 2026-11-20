import { BadUserInputError } from '@/errors/graphql-errors'
import FlowConnections from '@/models/flow-connections'

import type { MutationResolvers } from '../__generated__/types.generated'

const deleteConnection: MutationResolvers['deleteConnection'] = async (
  _parent,
  params,
  context,
) => {
  const { input } = params
  if (!input) {
    throw new BadUserInputError('Missing input')
  }

  return await FlowConnections.transaction(async (trx) => {
    await context.currentUser
      .$relatedQuery('connections', trx)
      .delete()
      .findOne({
        id: input.id,
      })
      .throwIfNotFound()

    // also delete the connection from the flow_connections table for flows with collaborators
    await FlowConnections.query(trx).delete().where({ connection_id: input.id })

    return true
  })
}

export default deleteConnection
