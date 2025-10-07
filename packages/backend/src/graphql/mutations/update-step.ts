import { BadUserInputError } from '@/errors/graphql-errors'
import {
  addFlowConnection,
  addFlowTableConnection,
} from '@/helpers/add-flow-connection'
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

  const step = await Step.transaction(async (trx) => {
    const step = await context.currentUser
      .withAccessibleSteps({ requiredRole: 'editor', trx })
      .withGraphFetched('flow')
      .findOne({
        'steps.id': input.id,
        'steps.flow_id': input.flow.id,
      })

    if (!step) {
      throw new BadUserInputError('Step not found')
    }

    step.flow.assertNotUpdatedSince(input.flow.updatedAt)

    if (input.connection.id) {
      // if connectionId is specified, verify that the connection exists
      const connection = await getConnection({
        context,
        connectionId: input.connection.id,
        flowId: input.flow.id,
        role: step.flow.role,
        requiredRole: 'editor',
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
      const app = await App.findOneByKey(input.appKey)
      const action = app?.actions?.find((action) => action.key === step.key)
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
    if (step.role === 'owner') {
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
      trx,
    })

    return { ...updatedStep, flow: { updatedAt: updatedFlow.updatedAt } }
  })

  return step
}

export default updateStep
