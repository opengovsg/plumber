import type { IJSONObject } from '@plumber/types'

import { isEmpty } from 'lodash'

import logger from '@/helpers/logger'
import Flow from '@/models/flow'
import Step from '@/models/step'

import { MutationResolvers } from '../__generated__/types.generated'

function updateStepIdForKey(
  value: string,
  oldToNewStepIdsMap: Record<string, string>,
) {
  /**
   * Example: this step position 3 has a key: "subject" and
   * a value of "{{step.123.fields.111.answer}} blah {{step.456.fields.222.answer}}"
   * 123 and 456 belongs to the previous 2 steps, so the mapping will be the old steps to new steps
   * */
  let newValue = value
  for (const stepIdMapping of Object.entries(oldToNewStepIdsMap)) {
    const [oldStepId, newStepId] = stepIdMapping
    // Replaces data-id in postman also and all step variables with the curly braces notation
    const partialOldVariable = `step.${oldStepId}.`
    const partialNewVariable = `step.${newStepId}.`

    newValue = newValue.replaceAll(partialOldVariable, partialNewVariable)
  }
  return newValue
}

function updateStepVariables(
  parameters: Step['parameters'],
  oldToNewStepIdsMap: Record<string, string>,
): Step['parameters'] {
  const entries = Object.entries(parameters)
  return entries.reduce((result, [key, value]) => {
    if (typeof value === 'string') {
      return {
        ...result,
        [key]: updateStepIdForKey(value, oldToNewStepIdsMap),
      }
    }

    if (Array.isArray(value)) {
      return {
        ...result,
        [key]: value.map((item) => {
          // could be a string or an object: attachments array would contain strings but conditions would contain objects
          if (typeof item === 'string') {
            return updateStepIdForKey(item, oldToNewStepIdsMap)
          }
          return updateStepVariables(item as IJSONObject, oldToNewStepIdsMap)
        }),
      }
    }

    return {
      ...result,
      [key]: value,
    }
  }, {})
}

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
    delete prevConfig['demoConfig']
    delete prevConfig['templateConfig']

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
