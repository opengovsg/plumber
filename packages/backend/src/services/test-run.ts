import { type IAction } from '@plumber/types'

import { getOnPipePublishOrBeforeTestRunHook } from '@/helpers/actions'
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
  // Process actions' before-test-run hooks.
  //
  // NOTE: These hooks may modify the underlying flow / steps. Instead of
  // forcing hooks to use patchAndFetch, we will query the DB one more time
  // after this phase. This is because Objection's ___andFetch uses 2 queries
  // under the hood; making hooks use this is actually a pessimization compared
  // to us making one(-ish) more DB query later.

  const hooksToRun: ReturnType<
    NonNullable<IAction['onPipePublishOrBeforeTestRun']>
  >[] = []

  for (const step of untilStep.flow.steps) {
    if (step.type !== 'action') {
      continue
    }

    const hook = await getOnPipePublishOrBeforeTestRunHook(
      step.appKey,
      step.key,
    )
    if (!hook) {
      continue
    }

    hooksToRun.push(hook(untilStep.flow))
  }

  await Promise.all(hooksToRun)

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

  for (const actionStep of actionSteps) {
    const { executionStep: actionExecutionStep } = await processAction({
      flowId: flow.id,
      stepId: actionStep.id,
      executionId,
      testRun: true,
    })

    if (actionStep.id === untilStep.id || actionExecutionStep.isFailed) {
      return { executionStep: actionExecutionStep }
    }
  }
}

export default testRun
