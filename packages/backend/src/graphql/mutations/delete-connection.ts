import { BadUserInputError } from '@/errors/graphql-errors'
import Flow from '@/models/flow'
import FlowConnections from '@/models/flow-connections'
import Step from '@/models/step'

import type { MutationResolvers } from '../__generated__/types.generated'

const MAX_PIPE_NAMES_IN_ERROR = 5

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
    const publishedFlowsUsingConnection = () =>
      Flow.query(trx)
        .where('flows.active', true)
        .whereExists(
          Step.query(trx)
            .select(1)
            .whereColumn('steps.flow_id', 'flows.id')
            .where('steps.connection_id', connection.id),
        )

    const publishedFlowCount =
      await publishedFlowsUsingConnection().resultSize()

    if (publishedFlowCount > 0) {
      // A collaborator's connection can be used in a pipe owned by someone
      // else, so only name the pipes this user can access.
      const accessibleFlows = await context.currentUser
        .withAccessibleFlows({
          requiredRole: 'viewer',
          queryBuilder: publishedFlowsUsingConnection(),
          trx,
        })
        .orderBy('flows.name')
        .limit(MAX_PIPE_NAMES_IN_ERROR)

      const names = accessibleFlows.map((flow) => `"${flow.name}"`).join(', ')
      const hiddenCount = publishedFlowCount - accessibleFlows.length

      const pipeList =
        hiddenCount > 0
          ? `${names}${names ? ' and ' : ''}${hiddenCount} other pipe(s)`
          : names

      throw new BadUserInputError(
        `This connection is used by published pipe(s): ${pipeList}. Unpublish them or switch their connection before deleting.`,
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
