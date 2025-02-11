import type { IGlobalVariable, IStep } from '@plumber/types'

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

  const currDepth = parseInt(currBranchStep.parameters?.depth as string)

  if (isNaN(currDepth)) {
    throw new Error(
      `Branch depth for current branch step ${currBranchStep.id} is not defined for ${$.step.id}.`,
    )
  }

  // search for next branch after current step
  const nextBranchStep = flowSteps
    .slice(indexOfCurrentStep + 1)
    .find((step) => {
      if (!(step.appKey === 'toolbox' && step.key === 'ifThen')) {
        return false
      }

      const nextBranchDepth = parseInt(step.parameters?.depth as string)
      if (isNaN(nextBranchDepth)) {
        throw new Error(
          `Branch depth for future branch step ${$.step.id} is not defined.`,
        )
      }

      return nextBranchDepth <= currDepth
    })
  return nextBranchStep?.id
}
