import { IJSONObject, ITriggerItem } from '@plumber/types'

import logger from '@/helpers/logger'
import Execution from '@/models/execution'
import Step from '@/models/step'

type ProcessTriggerOptions = {
  flowId: string
  stepId: string
  triggerItem?: ITriggerItem
  error?: IJSONObject
  testRun?: boolean
}

// TODO(ian): change this function name, it's basically just storing trigger data
export const processTrigger = async (options: ProcessTriggerOptions) => {
  const { flowId, stepId, triggerItem, error, testRun } = options

  const step = await Step.query().findById(stepId).throwIfNotFound()

  let shouldExecute = true
  if (step.appKey === 'formsg' && !testRun) {
    const execution = await Execution.query()
      .where({
        flow_id: flowId,
        test_run: false,
        internal_id: triggerItem?.meta.internalId,
      })
      .first()

    if (execution && execution.internalId === triggerItem?.meta.internalId) {
      logger.error(
        `FormSG: ${triggerItem?.raw.formId} - submissionId: ${triggerItem?.meta.internalId} already exists in execution: ${execution.id}`,
      )
      shouldExecute = false

      return {
        flowId,
        stepId,
        executionId: execution.id,
        executionStep: null,
        shouldExecute,
      }
    }
  }

  const execution = await Execution.query().insert({
    flowId,
    testRun,
    internalId: triggerItem?.meta.internalId,
    ...(error && { status: 'failure' }),
  })

  const executionStep = await execution
    .$relatedQuery('executionSteps')
    .insertAndFetch({
      stepId: step.id,
      status: error ? 'failure' : 'success',
      dataIn: step.parameters,
      dataOut: !error ? triggerItem?.raw : null,
      errorDetails: error,
      appKey: step.appKey,
      metadata: triggerItem?.isMock ? { isMock: true } : {},
    })

  return {
    flowId,
    stepId,
    executionId: execution.id,
    executionStep,
    shouldExecute,
  }
}
