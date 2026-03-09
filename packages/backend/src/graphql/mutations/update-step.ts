import { IAction } from '@/../../types'
import { BadUserInputError } from '@/errors/graphql-errors'
import {
  addFlowConnection,
  addFlowTableConnection,
} from '@/helpers/add-flow-connection'
import logger from '@/helpers/logger'
import App from '@/models/app'
import Step from '@/models/step'
import { getConnection } from '@/services/connection'

import type { MutationResolvers } from '../__generated__/types.generated'

const updateStep: MutationResolvers['updateStep'] = async (
  _parent,
  params,
  context,
) => {
  const { input } = params

  const triggerOrAction = await App.findTriggerOrActionByKey(
    input.appKey,
    input.key,
  )
  if (!triggerOrAction) {
    logger.error({
      event: 'updateStep: no such trigger or action',
      appKey: input.appKey,
      key: input.key,
    })
    throw new BadUserInputError('No such trigger or action')
  }

  const step = await Step.transaction(async (trx) => {
    const step = await context.currentUser
      .withAccessibleSteps({ requiredRole: 'editor', trx })
      .findOne({
        'steps.id': input.id,
        'steps.flow_id': input.flow.id,
      })

    if (!step) {
      throw new BadUserInputError('Step not found')
    }

    step.flow.assertNotUpdatedSince(
      input.flow.updatedAt,
      context.currentUser.id,
    )

    if (input.connection.id) {
      // if connectionId is specified, verify that the connection exists
      const connection = await getConnection({
        context,
        connectionId: input.connection.id,
        flowId: input.flow.id,
        includeOwnConnections: step.flow.role === 'owner',
        trx,
      })

      // we check that the connection exists and is the same app
      if (!connection || connection.key !== input.appKey) {
        throw new BadUserInputError('Connection not found')
      }
    }

    // NOTE: we use this function to first validate the step parameters
    // to avoid misuse and saving invalid step parameters
    if (step.type === 'action') {
      const action = triggerOrAction as IAction
      if (action?.hiddenFromUser) {
        throw new BadUserInputError('Action can only be updated by system')
      }
      action?.validateStepParameters?.(input.parameters)
    }

    const shouldInvalidate =
      step.key !== input.key ||
      step.appKey !== input.appKey ||
      input.status === 'incomplete'

    const stepName = input?.config?.stepName ?? step?.config?.stepName
    const existingConfig = step?.config ?? {}

    const updatedStep = await Step.query(trx)
      .patchAndFetchById(input.id, {
        key: input.key,
        appKey: input.appKey,
        connectionId: input.connection.id,
        parameters: input.parameters,
        status: shouldInvalidate ? 'incomplete' : step.status,
        updatedBy: context.currentUser.id,
        config: {
          ...existingConfig,
          // NOTE: check for undefined to allow empty string, which defaults to the action/trigger name
          ...(stepName !== undefined ? { stepName } : {}),
        },
      })
      .withGraphFetched({
        connection: true,
        flow: true,
      })

    /**
     * NOTE: we need to update flow connections for apps with connections:
     * Tiles:
     * 1. add the collaborator to the flow connections table
     * 2. add the collaborator to the table collaborators table
     *
     * TODO (kevinkim-ogp): phase 2
     * collaborator should be able to add their own tiles,
     * and the owner will be added as an editor to the Tile
     *
     * Other connections:
     * 1. add the collaborator to the flow connections table
     *
     * TODO (kevinkim-ogp): phase 2
     * collaborator should be able to add their own connections,
     * it will be tied to this specific flow only
     */
    if (step.flow.role === 'owner') {
      const appKey = updatedStep?.appKey

      // tiles special handling
      if (appKey === 'tiles' && updatedStep?.parameters?.tableId) {
        await addFlowTableConnection({
          flowId: updatedStep.flowId,
          tableId: updatedStep.parameters.tableId as string,
          addedBy: context.currentUser.id,
          trx,
        })
      } else if (updatedStep?.connectionId) {
        await addFlowConnection({
          step: updatedStep,
          addedBy: context.currentUser.id,
          trx,
        })
      }
    }

    // update the flow's last updated
    const updatedFlow = await step.flow.patchLastUpdated({
      flowId: step.flowId,
      updatedBy: context.currentUser.id,
      trx,
    })

    // do this instead of spreading the updatedStep so that it preserves the Model instance
    updatedStep.flow.updatedAt = updatedFlow.updatedAt
    updatedStep.flow.updatedBy = context.currentUser.id
    return updatedStep
  })

  return step
}

export default updateStep
