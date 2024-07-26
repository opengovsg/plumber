import Step from '@/models/step'
import { processAction } from '@/services/action'
import { processFlow } from '@/services/flow'
import { processTrigger } from '@/services/trigger'

type TestRunOptions = {
  stepId: string
}

const testRun = async (options: TestRunOptions) => {
  let untilStep = await Step.query()
    .findById(options.stepId)
    .withGraphFetched({
      flow: {
        steps: true,
      },
    })

  //
  // Start test run
  //

  untilStep = await Step.query()
    .findById(options.stepId)
    .withGraphFetched({
      flow: {
        steps: true,
      },
    })
    .modifyGraph('flow.steps', (builder) => builder.orderBy('position', 'asc'))

  const flow = untilStep.flow
  const [triggerStep, ...actionSteps] = untilStep.flow.steps

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

  // Actions may redirect steps. We keep track here so that we can let users
  // know if an action would have been skipped due to redirection.
  let nextStepId = actionSteps[0]?.id

  for (const actionStep of actionSteps) {
    const { executionStep: actionExecutionStep, nextStep } =
      await processAction({
        flowId: flow.id,
        stepId: actionStep.id,
        executionId,
        testRun: true,
      })

    if (actionExecutionStep.isFailed || actionStep.id === untilStep.id) {
      return { executionStep: actionExecutionStep }
    }

    // Don't update next step ID if actionStep wouldn't have been run in real
    // life.
    if (actionStep.id === nextStepId) {
      nextStepId = nextStep?.id
    }
  }

  await flow.$query().patch({
    testExecutionId: executionId,
  })
}

export default testRun
