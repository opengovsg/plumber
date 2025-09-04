import { BadUserInputError } from '@/errors/graphql-errors'
import {
  APP_CONNECTION_FIELDS,
  TILES_CONNECTION_ID,
} from '@/helpers/get-shared-connection-details'
import App from '@/models/app'
import FlowConnections from '@/models/flow-connections'
import Step from '@/models/step'

import type { MutationResolvers } from '../__generated__/types.generated'

const updateStep: MutationResolvers['updateStep'] = async (
  _parent,
  params,
  context,
) => {
  const { input } = params

  const step = await Step.transaction(async (trx) => {
    const step = await context.currentUser
      .withAccessible({ type: 'step', requiredRole: 'editor', trx })
      .withGraphFetched('flow')
      .findOne({
        'steps.id': input.id,
        flow_id: input.flow.id,
      })
    if (!step) {
      throw new BadUserInputError('Step not found')
    }

    if (input.connection.id) {
      // if connectionId is specified, verify that the connection exists
      const connection = await context.currentUser
        .withAccessible({ type: 'connection', requiredRole: 'editor' })
        .findOne({ 'connections.id': input.connection.id })
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
     * NOTE: we need to update flow connections for specific apps:
     */
    if (APP_CONNECTION_FIELDS[updatedStep.appKey] && step.role === 'owner') {
      const { parameterKey } = APP_CONNECTION_FIELDS[updatedStep.appKey]

      let userId = updatedStep?.connection?.userId
      let connectionId = updatedStep?.connectionId
      if (updatedStep.appKey === 'tiles') {
        userId = updatedStep.flow.userId
        connectionId = TILES_CONNECTION_ID
      }

      if (updatedStep.parameters[parameterKey]) {
        await FlowConnections.patchFlowConnectionMetadata({
          flowId: updatedStep.flowId,
          connectionId,
          userId,
          parameterKey,
          parameterValue: updatedStep.parameters[parameterKey] as string,
        })
      } else {
        await FlowConnections.addFlowConnection({
          flowId: updatedStep.flowId,
          connectionId,
          userId,
        })
      }
    }

    // update the flow's last updated
    await step.flow.patchLastUpdated({ flowId: step.flowId, trx })

    return updatedStep
  })

  return step
}

export default updateStep
