import { isEmpty } from 'lodash'

import logger from '@/helpers/logger'
import { updateStepVariables } from '@/helpers/update-duplicated-steps'
import Flow from '@/models/flow'

import { MutationResolvers } from '../__generated__/types.generated'

// transaction does 2 things: update duplicate count for flow + duplicate flow + steps
const duplicateFlow: MutationResolvers['duplicateFlow'] = async (
  _parent,
  params,
  context,
) => {
  const oldFlowId = params.input.id
  const flow = await context.currentUser
    .$relatedQuery('flows')
    .withGraphJoined('[steps.[connection]]')
    .orderBy('steps.position', 'asc')
    .findOne({ 'flows.id': oldFlowId })
    .throwIfNotFound()

  return await Flow.transaction(async (trx) => {
    const prevConfig = { ...flow.config }
    // update duplicate count for the original flow
    await flow.$query(trx).patch({
      config: {
        ...prevConfig,
        duplicateCount: flow.config?.duplicateCount
          ? flow.config.duplicateCount + 1
          : 1,
      },
    })

    // duplicate the flow with the previous config (only keep notification frequency)
    delete prevConfig['duplicateCount']
    delete prevConfig['templateConfig']
    delete prevConfig['showSurvey']
    delete prevConfig['attachments']

    const duplicatedFlow = await context.currentUser
      .$relatedQuery('flows', trx)
      .insert({
        name: `[COPY] ${flow.name}`,
        active: false,
        config: !isEmpty(prevConfig) ? prevConfig : undefined,
      })

    // duplicate the steps and the variables
    const oldToNewStepIdsMap: Record<string, string> = {}
    for (const oldStep of flow.steps) {
      const duplicatedStep = await duplicatedFlow
        .$relatedQuery('steps', trx)
        .insert({
          key: oldStep.key,
          appKey: oldStep.appKey,
          type: oldStep.type,
          connectionId: oldStep.connectionId,
          connection: oldStep.connection,
          position: oldStep.position,
          parameters: updateStepVariables(
            oldStep.parameters,
            oldToNewStepIdsMap,
          ),
        })
      oldToNewStepIdsMap[oldStep.id] = duplicatedStep.id // update map after duplicating step
    }

    logger.info('Duplicate flow details', {
      event: 'duplicate-flow-request',
      originalFlow: oldFlowId,
      duplicatedFlow: duplicatedFlow.id,
      stepsMapping: oldToNewStepIdsMap,
    })

    return duplicatedFlow
  })
}

export default duplicateFlow
