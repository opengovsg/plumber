import type { IGlobalVariable, IStep } from '@plumber/types'

import logger from '@/helpers/logger'
import Step from '@/models/step'

export async function getBranchStepIdToSkipTo(
  $: IGlobalVariable,
): Promise<IStep['id']> {
  // PERF-FIXME: Objectionjs does no caching, so this will almost always be
  // queried multiple times by the same worker during a test run. If it does
  // turn out to impact perf, we can LRU memoize this by executionId.

  /**
   * We do this because this could be executed by only continue if, we
   * need to find the preceding if-then
   */

  const flowSteps = await Step.query()
    .where('flow_id', $.flow.id)
    .orderBy('position', 'asc')
    .throwIfNotFound()

  // This should be position - 1 but we check in case position goes out of order
  const indexOfCurrentStep = flowSteps.findIndex(
    (step) => step.id === $.step.id,
  )

  if (indexOfCurrentStep !== $.step.position - 1) {
    // this is a sanity check to ensure the step is at the expected position
    console.error(
      `Bug: Current step ${$.step.id} is not at the expected position. The positioning of steps for flow ${$.flow.id} may be out of order.`,
    )
  }

  // search for immediate branch before current step
  const currBranchStep = flowSteps
    .slice(0, indexOfCurrentStep + 1)
    .reverse()
    .find((step) => step.appKey === 'toolbox' && step.key === 'ifThen')

  // only continue if step could be before any if-then branches
  if (!currBranchStep) {
    return null
  }

  // New-style pipes store this key on every if-then: a string means there is a
  // later branch to jump to, while null means "stop".
  //
  // NOTE: Returning here skips the MRF approval-boundary check below, which is
  // safe - the front-end will never set stepIdToJumpTo across an MRF
  // approval/reject boundary.
  const params = currBranchStep.parameters
  if (params && Object.hasOwn(params, 'stepIdToJumpTo')) {
    const jumpTo = params.stepIdToJumpTo
    return typeof jumpTo === 'string' ? jumpTo : null
  }

  // Everything below supports legacy pipes: those created before If-then-then
  // was implemented, which lack a stored stepIdToJumpTo. They are handled by
  // the original depth scan (plus the MRF approval-boundary check).
  let currDepth = parseInt(currBranchStep.parameters?.depth as string)

  if (isNaN(currDepth)) {
    logger.warn(
      `Branch depth for current branch step ${currBranchStep.id} is not defined for ${$.step.id}.`,
    )
    //  This an unreproducible bug where the depth is not defined for the step. since it's not possible to nest if-then at
    // this point of time, we default the depth to 0.
    currDepth = 0
  }

  // search for next branch after current step
  const nextBranchStep = flowSteps
    .slice(indexOfCurrentStep + 1)
    .find((step) => {
      if (!(step.appKey === 'toolbox' && step.key === 'ifThen')) {
        return false
      }

      let nextBranchDepth = parseInt(step.parameters?.depth as string)
      if (isNaN(nextBranchDepth)) {
        logger.warn(
          `Branch depth for future branch step ${$.step.id} is not defined.`,
        )
        // This an unreproducible bug where the depth is not defined for the step. since it's not possible to nest if-then at
        // this point of time, we default the depth to 0.
        nextBranchDepth = 0
      }
      return nextBranchDepth <= currDepth
    })

  if (!nextBranchStep) {
    return null
  }

  // To account for MRF flows: don't skip across approval/rejection branch boundaries,
  // or into a rejection branch belonging to a different MRF approval step.
  const currApproval = currBranchStep.config?.approval
  const nextApproval = nextBranchStep.config?.approval
  const isSameBranch =
    currApproval?.branch === 'reject' && nextApproval?.branch === 'reject'
      ? currApproval.stepId === nextApproval.stepId
      : currApproval?.branch !== 'reject' && nextApproval?.branch !== 'reject'

  return isSameBranch ? nextBranchStep.id : null
}
