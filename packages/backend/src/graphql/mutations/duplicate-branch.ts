import { IStepConfig } from '@plumber/types'

import { raw } from 'objection'

import { BadUserInputError } from '@/errors/graphql-errors'
import Step from '@/models/step'
import { getConnection } from '@/services/connection'

import type { MutationResolvers } from '../__generated__/types.generated'

const duplicateBranch: MutationResolvers['duplicateBranch'] = async (
  _parent,
  params,
  context,
) => {
  const { input } = params

  return await Step.transaction(async (trx) => {
    await trx.raw('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;')

    // validate user has access to the flow AND
    // that the flow has not been updated since the client last fetched it
    const flow = await context.currentUser
      .withAccessibleFlows({ trx, requiredRole: 'editor' })
      .findOne({
        id: input.flow.id,
      })
      .throwIfNotFound()

    flow.assertNotUpdatedSince(input.flow.updatedAt, context.currentUser.id)

    // create all the steps in the transaction so that if any fails
    // this entire query fails
    const newSteps: Step[] = []
    let previousStepId = input.previousStep.id
    for (const branchStep of input.steps) {
      const { connection, key, appKey, parameters, config } = branchStep

      // if connectionId is specified, verify that the connection exists
      // and the user has the appropriate permissions to use it
      // user has to be an editor in the pipe
      if (connection?.id) {
        /**
         * NOTE: with collaborators,
         * Owner can use existing connections or add new connections to the pipe
         * Editor can only use existing connections that have been shared to the pipe
         * (TODO: phase 2) Editor will be able to add their own connections
         */
        const verifiedConnection = await getConnection({
          context,
          connectionId: connection?.id,
          flowId: flow.id,
          includeOwnConnections: flow.role === 'owner',
          trx,
        })

        if (!verifiedConnection) {
          throw new BadUserInputError('Connection not found')
        }
      }

      const previousStep = await flow
        .$relatedQuery('steps', trx)
        .findOne({
          id: previousStepId,
        })
        .throwIfNotFound()

      await flow
        .$relatedQuery('steps', trx)
        .patch({
          position: raw(`position + 1`),
        })
        .where('position', '>=', previousStep.position + 1)

      const step = await flow.$relatedQuery('steps', trx).insertAndFetch({
        key,
        appKey,
        type: 'action',
        position: previousStep.position + 1,
        parameters,
        connectionId: connection?.id,
        config: config as IStepConfig,
      })

      newSteps.push(step)
      previousStepId = step.id

      // NOTE: slight difference from createStep where createStep
      // may need to add to flow_connections, but duplicateBranch does not
      // as the connection would have already been added when the step
      // was created in the original branch
    }

    const updatedFlow = await flow.patchLastUpdated({
      flowId: flow.id,
      updatedBy: context.currentUser.id,
      trx,
    })

    return {
      steps: newSteps,
      flow: {
        updatedAt: updatedFlow.updatedAt,
      },
    }
  })
}

export default duplicateBranch
