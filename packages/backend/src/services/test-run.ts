import ExecutionStep from '@/models/execution-step'
import Step from '@/models/step'
import { processAction } from '@/services/action'
import { processFlow } from '@/services/flow'
import { processTrigger } from '@/services/trigger'

interface TestRunOptions {
  stepId: string
}

interface TestRunResult {
  executionStep: ExecutionStep
  executionId: string
}

const testRun = async (options: TestRunOptions): Promise<TestRunResult> => {
  const untilStep = await Step.query()
    .findById(options.stepId)
    .withGraphFetched({
      flow: {
        steps: true,
      },
    })
    .modifyGraph('flow.steps', (builder) => builder.orderBy('position', 'asc'))

  //
  // Start test run
  //

  const flow = untilStep.flow
  const [triggerStep, ...actionSteps] = untilStep.flow.steps

  const { data, error: triggerError } = await processFlow({
    flowId: flow.id,
    testRun: true,
  })

  // Just giving it a more descriptive name here
  const hasTriggerStepFailed = !!triggerError

  const { executionId, executionStep: triggerExecutionStep } =
    await processTrigger({
      flowId: flow.id,
      stepId: triggerStep.id,
      error: hasTriggerStepFailed ? triggerError : undefined,
      triggerItem: hasTriggerStepFailed ? undefined : data[0],
      testRun: true,
    })

  // We store the last run executionStep to return
  let executionStepToReturn = triggerExecutionStep
  // We return early if the trigger step has failed or only trigger step was tested
  if (hasTriggerStepFailed || triggerStep.id === untilStep.id) {
    return { executionStep: executionStepToReturn, executionId }
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
      // Store as test execution for easy retrieval later on
      executionStepToReturn = actionExecutionStep
      break
    }

    // Don't update next step ID if actionStep wouldn't have been run in real
    // life.
    if (actionStep.id === nextStepId) {
      nextStepId = nextStep?.id
    }
  }

  return { executionStep: executionStepToReturn, executionId }
}

export default testRun
