import { IJSONObject, ITriggerItem } from '@plumber/types'

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

  return { flowId, stepId, executionId: execution.id, executionStep }
}
