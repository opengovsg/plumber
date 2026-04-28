import { GraphQLError } from 'graphql/error'

import { ForbiddenError } from '@/errors/graphql-errors'
import { BadUserInputError } from '@/errors/graphql-errors/bad-user-input'
import logger from '@/helpers/logger'
import FlowConnections from '@/models/flow-connections'
import Step from '@/models/step'

import { MutationResolvers } from '../__generated__/types.generated'

const deleteFlowConnection: MutationResolvers['deleteFlowConnection'] = async (
  _parent,
  params,
  context,
) => {
  const { flowId, connectionId, connectionType } = params.input as {
    flowId: string
    connectionId: string
    connectionType: 'connection' | 'table'
  }

  try {
    return await FlowConnections.transaction(async (trx) => {
      // this user needs to first be a flow owner or editor to delete the flow connection
      const flow = await context.currentUser
        .withAccessibleFlows({ requiredRole: 'editor' })
        .findById(flowId)

      if (!flow) {
        throw new ForbiddenError('You do not have access to this flow')
      }

      if (flow.active) {
        throw new BadUserInputError(
          'You cannot delete a connection when the Pipe is published',
        )
      }

      // check if the connection is in use by any steps
      // do not delete if they are still in use
      let steps: Step[] = []

      if (connectionType === 'connection') {
        steps = await flow.$relatedQuery('steps', trx).where({
          connection_id: connectionId,
          flow_id: flowId,
        })
      }

      if (connectionType === 'table') {
        // if its a tiles table, we need to remove the tableId from the step parameters
        steps = await flow
          .$relatedQuery('steps', trx)
          .whereRaw(`parameters->>'tableId' = ?`, [connectionId])
          .where('flow_id', flowId)
          .where('app_key', 'tiles')
      }

      if (steps?.length > 0) {
        logger.error({
          message: 'Connection is in use and cannot be deleted.',
          data: {
            flowId,
            connectionId,
            connectionType,
          },
        })
        throw new BadUserInputError(
          'Connection is in use and cannot be deleted.',
        )
      }

      // delete the flow connection only after verifying that the connection is not in use
      await FlowConnections.query(trx).delete().where({
        flow_id: flowId,
        connection_id: connectionId,
        connection_type: connectionType,
      })

      return true
    })
  } catch (error) {
    logger.error({
      message: 'Failed to delete flow connection',
      data: {
        flowId,
        connectionId,
        error,
      },
    })
    if (error instanceof GraphQLError) {
      throw error
    }
    throw new Error('Failed to delete flow connection')
  }
}

export default deleteFlowConnection
