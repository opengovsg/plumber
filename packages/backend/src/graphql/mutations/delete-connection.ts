import { BadUserInputError } from '@/errors/graphql-errors'
import Flow from '@/models/flow'
import FlowConnections from '@/models/flow-connections'
import Step from '@/models/step'

import type { MutationResolvers } from '../__generated__/types.generated'

const deleteConnection: NonNullable<
  MutationResolvers['deleteConnection']
> = async (_parent, params, context) => {
  const { input } = params
  if (!input) {
    throw new BadUserInputError('Missing input')
  }

  return await FlowConnections.transaction(async (trx) => {
    const connection = await context.currentUser
      .$relatedQuery('connections', trx)
      .findOne({
        id: input.id,
      })
      // IMPORTANT: Publishing locks the same row, so a publish cannot commit
      // between the published-pipe check below and the soft delete.
      .forUpdate()
      .throwIfNotFound()

    // Deleting a connection that a published pipe uses leaves its executions
    // stuck in "waiting".
    const hasPublishedFlows = await Flow.query(trx)
      .where('flows.active', true)
      .whereExists(
        Step.query(trx)
          .select(1)
          .whereColumn('steps.flow_id', 'flows.id')
          .where('steps.connection_id', connection.id),
      )
      .limit(1)
      .resultSize()

    if (hasPublishedFlows > 0) {
      throw new BadUserInputError(
        'This connection is used by a published pipe. Unpublish the pipe or switch its connection before deleting.',
      )
    }

    await context.currentUser
      .$relatedQuery('connections', trx)
      .delete()
      .findOne({
        id: connection.id,
      })
      .throwIfNotFound()

    // also delete the connection from the flow_connections table for flows with collaborators
    await FlowConnections.query(trx).delete().where({ connection_id: input.id })

    return true
  })
}

export default deleteConnection
