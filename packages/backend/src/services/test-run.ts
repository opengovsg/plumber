import { type IAction } from '@plumber/types'

import { getOnPipePublishOrBeforeTestRunHook } from '@/helpers/actions'
import { isIfThenStep } from '@/helpers/toolbelt'
import Step from '@/models/step'
import { processAction } from '@/services/action'
import { processFlow } from '@/services/flow'
import { processTrigger } from '@/services/trigger'

/**
 *
 * == EDGE CASE ==
 *
 * If we are testing a step within an if-then branch, we only want to execute
 * steps within that branch, as well as all steps located in ancestor branches.
 *
 * ---
 * Example:
 *
 * [T = trigger S = normal step, B = branch]
 *
 *   T
 *   |
 *   S1
 *   |
 *   B1
 *     \
 *      B1.1
 *        \
 *         S2
 *         |
 *         S3
 *        /
 *      B1.2
 *        \
 *         S4
 *       /
 *      /
 *   B2
 *     \
 *      S5
 *       |
 *      B2.1
 *        \
 *         S6
 *        /
 *      B2.2
 *        \
 *         S7
 *
 * If we are testing step S7, then we only want to execute:
 * - Concrete steps: S1, S5 and S7.
 * - Branch and sibling branch steps: B1, B2, B2.1 and B2.2
 *   - This is so that we can tell if S7 would have been skipped.
 *   - Running all sibling branches is needed because we need to keep nextStepId
 *     consistent in our main execution loop.
 * ---
 *
 * This function determines what steps to run. The high level idea is:
 *
 * 1. Start from the step being tested, and work backwards.
 * 2. While iterating backwards, we store each step we've seen inside an array,
 *    untilL we see an if-then branch step, or we reach the start of the pipe.
 *    This "steps array" basically stores the steps in current branch.
 * 3. If we see a branch step, we know all steps in our array belong to this
 *    branch. We now need to decide if we should execute these steps; we should
 *    only do so if:
 *    - We have never seen a branch before (thus the step being tested must be
 *      in our steps array, and we _must_ execute all steps in the array).
 *    - The current branch's depth is shallower than the depth of the branch we
 *      last saw (thus our steps array contains an ancestor branch's steps).
 *    Finally. regardless of whether we decided to execute steps in our array or
 *    not, we need to clear the steps array - since the next step will be a tail
 *    end of a new branch.
 *
 *
 * ** SMALL NOTE **
 * Actually, this function is a little over-complex since it supports nested
 * branches, which is not needed -  for release, we will not support branch
 * nesting. But the logic doesn't get much simpler if we don't support nesting:
 * instead of remembering the last seen depth, we just remember if we've seen a
 * branch. Because complexity reduction is not great, I decided to add in nested
 * branch support <.<
 */
function getStepIdsToExecuteForIfThen(
  untilStep: Step,
): ReadonlySet<Step['id']> {
  const result = new Set([untilStep.id])
  const previousSteps = untilStep.flow.steps.slice(0, untilStep.position - 1)

  let stepIdsInBranch: Array<Step['id']> = []
  let lastSeenDepth: number | null = 0
  for (let i = previousSteps.length - 1; i >= 0; i--) {
    const currStep = previousSteps[i]

    if (isIfThenStep(currStep)) {
      const depth = parseInt(currStep.parameters.depth as string)

      if (!lastSeenDepth || depth < lastSeenDepth) {
        // This branch step is the containing or ancestor branch, so we must run
        // its steps.
        for (const stepIdInBranch of stepIdsInBranch) {
          result.add(stepIdInBranch)
        }

        // We always run the associated branch step.
        result.add(currStep.id)
      } else if (depth === lastSeenDepth) {
        // This is a sibling branch step, so run it!
        result.add(currStep.id)
      }

      lastSeenDepth = depth
      stepIdsInBranch = []
    } else {
      stepIdsInBranch.push(currStep.id)
    }
  }

  for (const stepIdInBranch of stepIdsInBranch) {
    result.add(stepIdInBranch)
  }

  return result
}

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
  const [triggerStep] = flow.steps
  let actionSteps = flow.steps.slice(1)

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

  // **EDGE CASE**
  // If untilStep is a step located in an If-Then branch, we don't want to run
  // steps outside that branch.
  const stepsToExecute = getStepIdsToExecuteForIfThen(untilStep)
  const untilStepIsInIfThenBranch = stepsToExecute.size !== flow.steps.length
  let untilStepInIfThenBranchIsReached = true

  actionSteps = actionSteps.filter((step) => stepsToExecute.has(step.id))
  for (let i = 0; i < actionSteps.length; i++) {
    const actionStep = actionSteps[i]

    const { executionStep: actionExecutionStep, nextStep } =
      await processAction({
        flowId: flow.id,
        stepId: actionStep.id,
        executionId,
        testRun: true,
      })

    if (actionExecutionStep.isFailed) {
      return { executionStep: actionExecutionStep }
    }

    if (actionStep.id === untilStep.id) {
      return {
        executionStep: actionExecutionStep,
        wouldHaveBeenSkipped: untilStepIsInIfThenBranch
          ? untilStepInIfThenBranchIsReached
          : actionStep.id !== nextStepId,
      }
    }

    // Don't update next step ID if actionStep wouldn't have been run in real
    // life. For steps within if-then branches, the logic is much trickier, so
    // we compute separately to reduce code complexity.
    if (!untilStepIsInIfThenBranch && actionStep.id === nextStepId) {
      nextStepId = nextStep?.id
    }

    if (untilStepIsInIfThenBranch && isIfThenStep(actionStep)) {
      untilStepInIfThenBranchIsReached =
        untilStepInIfThenBranchIsReached &&
        (actionExecutionStep.dataOut.isBranchTaken as boolean)
    }
  }
}

export default testRun
