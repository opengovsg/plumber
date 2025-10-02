import { raw } from 'objection'

import { BadUserInputError, ForbiddenError } from '@/errors/graphql-errors'
import Connection from '@/models/connection'
import FlowConnections from '@/models/flow-connections'
import Step from '@/models/step'

import type { MutationResolvers } from '../__generated__/types.generated'

const createStep: MutationResolvers['createStep'] = async (
  _parent,
  params,
  context,
) => {
  const { input } = params

  return await Step.transaction(async (trx) => {
    await trx.raw('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;')

    // Put SELECTs in transaction just in case there's concurrent modification.
    const flow = await context.currentUser
      .withAccessibleFlows({ trx, requiredRole: 'editor' })
      .findOne({
        id: input.flow.id,
      })
      .throwIfNotFound()

    flow.assertNotUpdatedSince(input.flow.updatedAt)

    // if connectionId is specified, verify that the connection exists
    // and the user has the appropriate permissions to use it
    // user has to be an editor in the pipe
    if (input.connection?.id) {
      let connection: Connection
      if (flow.role === 'owner') {
        connection = await context.currentUser
          .$relatedQuery('connections')
          .findOne({ id: input.connection.id })
      } else if (flow.role === 'editor') {
        // TODO (kevinkim-ogp): allow editors to create step with owner connections
        throw new ForbiddenError(
          'User does not have permission to add connection',
        )
      } else {
        throw new ForbiddenError(
          'User does not have permission to add connection',
        )
      }

      if (!connection) {
        throw new BadUserInputError('Connection not found')
      }
    }

    const previousStep = await flow
      .$relatedQuery('steps', trx)
      .findOne({
        id: input.previousStep.id,
      })
      .throwIfNotFound()

    await flow
      .$relatedQuery('steps', trx)
      .patch({
        position: raw(`position + 1`),
      })
      .where('position', '>=', previousStep.position + 1)

    const step = await flow.$relatedQuery('steps', trx).insertAndFetch({
      key: input.key,
      appKey: input.appKey,
      type: 'action',
      position: previousStep.position + 1,
      parameters: input.parameters,
      connectionId: input.connection?.id,
      config: input.config,
    })

    // NOTE: add flow connection to the flow_connections table
    // only add by default if the user is the owner of the flow
    // TODO (kevinkim-ogp): enhance this to allow editors to add connections
    if (input.connection?.id && flow.userId === context.currentUser.id) {
      await FlowConnections.addFlowConnection({
        flowId: flow.id,
        connectionId: input.connection.id,
        addedBy: context.currentUser.id,
        // it is always connection when creating a step since table is selected
        // only after the step is created
        connectionType: 'connection',
        trx,
      })
    }

    const updatedFlow = await flow.patchLastUpdated({ flowId: flow.id, trx })

    return {
      ...step,
      flow: {
        updatedAt: updatedFlow.updatedAt,
      },
    }
  })
}

export default createStep
