import { getTestExecutionSteps } from '@/helpers/get-test-execution-steps'
import Execution from '@/models/execution'
import ExecutionStep from '@/models/execution-step'
import Flow from '@/models/flow'
import Step from '@/models/step'
import { processAction } from '@/services/action'
import { processFlow } from '@/services/flow'
import { processTrigger } from '@/services/trigger'

interface TestStepOptions {
  stepId: string
}

interface TestStepResult {
  executionStep: ExecutionStep
  executionId: string
}
/**
 * What this does?
 * - We test a single step rather than from trigger to this step
 * - If a trigger is tested, a new excution is created and assigned to the flow as test_excection
 * Caveats:
 * - We do not check that prior steps have been executed. We assume that prior steps variables cant be used if they are not already tested
 * - This allows us to test steps from a if-then branch without having to test other branches
 */
const testStep = async (options: TestStepOptions): Promise<TestStepResult> => {
  const stepToTest = await Step.query()
    .findById(options.stepId)
    .withGraphFetched({
      flow: true,
    })
    .throwIfNotFound()

  let flow = stepToTest.flow
  if (flow.active) {
    throw new Error('Pipe is active. Cannot test steps in active pipe')
  }

  const testExecutionSteps = await getTestExecutionSteps(flow.id)

  /**
   * If none of the steps have been tested before, we create a new test execution
   */
  if (!testExecutionSteps.length) {
    const testExecution = await Execution.query().insert({
      flowId: flow.id,
      testRun: true,
    })
    flow.testExecution = testExecution
    flow.testExecutionId = testExecution.id
  }

  /**
   * For backwards compatibility, in the case where the test execution ID is not set
   * but has been tested before (i.e. test execution steps exist), we set the test execution ID
   */
  if (!flow.testExecutionId) {
    const [testTriggerExecutionStep, ...testActionExecutionSteps] =
      testExecutionSteps
    // We set the test execution ID to the test trigger execution id
    flow = await Flow.transaction(async (trx) => {
      const updatedFlow = await flow.$query(trx).patchAndFetch({
        testExecutionId: testTriggerExecutionStep.executionId,
      })
      // We then set the execution id for the rest of the test execution steps
      await ExecutionStep.query(trx)
        .patch({
          executionId: testTriggerExecutionStep.executionId,
        })
        .whereIn(
          'id',
          testActionExecutionSteps.map((execStep) => execStep.id),
        )
      return updatedFlow
    })
  }

  /**
   * If step is action, replace old execution step by setting execution id to null
   * and creating a new execution step with the test execution id
   */
  if (stepToTest.isAction) {
    const previousExecutionStep = testExecutionSteps.find(
      (execStep) => execStep.stepId === stepToTest.id,
    )

    const { executionStep: newExecutionStep } = await processAction({
      flowId: flow.id,
      stepId: stepToTest.id,
      executionId: flow.testExecutionId,
      testRun: true,
    })

    if (previousExecutionStep) {
      await previousExecutionStep.$query().delete()
    }
    return {
      executionStep: newExecutionStep,
      executionId: flow.testExecutionId,
    }
  }

  /**
   * If step is trigger, it gets a bit more complicated.
   * We need to create a new test execution and execution step.
   * Rewrite all the action execution steps with the new execution id
   */
  if (stepToTest.isTrigger) {
    const { data, error: triggerError } = await processFlow({
      flowId: flow.id,
      testRun: true,
    })

    const hasTriggerStepFailed = !!triggerError

    const { executionId, executionStep: triggerExecutionStep } =
      await processTrigger({
        flowId: flow.id,
        stepId: stepToTest.id,
        error: hasTriggerStepFailed ? triggerError : undefined,
        triggerItem: hasTriggerStepFailed ? undefined : data[0],
        testRun: true,
      })
    const [_previousTriggerExecutionStep, ...testActionExecutionSteps] =
      testExecutionSteps

    if (testActionExecutionSteps.length) {
      await ExecutionStep.query()
        .patch({
          executionId: executionId,
        })
        .whereIn(
          'id',
          testActionExecutionSteps.map((execStep) => execStep.id),
        )
    }
    return { executionStep: triggerExecutionStep, executionId }
  }
}

export default testStep
