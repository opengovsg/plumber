import Step from '@/models/step'
import { processAction } from '@/services/action'
import { processFlow } from '@/services/flow'
import { processTrigger } from '@/services/trigger'

type TestRunOptions = {
  stepId: string
}

const testRun = async (options: TestRunOptions) => {
  const untilStep = await Step.query()
    .findById(options.stepId)
    .throwIfNotFound()

  const flow = await untilStep.$relatedQuery('flow')
  const [triggerStep, ...actionSteps] = await flow
    .$relatedQuery('steps')
    .withGraphFetched('connection')
    .orderBy('position', 'asc')

  const { data, error: triggerError } = await processFlow({
    flowId: flow.id,
    testRun: true,
  })

  if (triggerError) {
    const { executionStep: triggerExecutionStepWithError } =
      await processTrigger({
        flowId: flow.id,
        stepId: triggerStep.id,
        error: triggerError,
        testRun: true,
      })

    return { executionStep: triggerExecutionStepWithError }
  }

  const firstTriggerItem = data[0]

  const { executionId, executionStep: triggerExecutionStep } =
    await processTrigger({
      flowId: flow.id,
      stepId: triggerStep.id,
      triggerItem: firstTriggerItem,
      testRun: true,
    })

  if (triggerStep.id === untilStep.id) {
    return { executionStep: triggerExecutionStep }
  }

  // Actions may redirect steps, so we keep track here. We want to loop through
  // _all_ possible actions during a test run, so that we can let people know if
  // an action was skipped due to redirection.
  let nextStepId = actionSteps[0]?.id

  for (const actionStep of actionSteps) {
    if (actionStep.id !== nextStepId) {
      if (!nextStepId || actionStep.id === untilStep.id) {
        throw new Error(
          'Unable to test step because it was skipped by conditional logic.',
        )
      }

      continue
    }

    const { executionStep: actionExecutionStep, nextStep } =
      await processAction({
        flowId: flow.id,
        stepId: actionStep.id,
        executionId,
      })

    if (actionStep.id === untilStep.id || actionExecutionStep.isFailed) {
      return { executionStep: actionExecutionStep }
    }

    nextStepId = nextStep?.id
  }
}

export default testRun
