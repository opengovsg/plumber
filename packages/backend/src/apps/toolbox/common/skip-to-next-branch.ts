import type { IGlobalVariable, IStep } from '@plumber/types'

import Step from '@/models/step'

export async function skipToNextBranch(
  $: IGlobalVariable,
  onlyContinueIfFlag?: boolean,
): Promise<IStep['id']> {
  // PERF-FIXME: Objectionjs does no caching, so this will almost always be
  // queried multiple times by the same worker during a test run. If it does
  // turn out to impact perf, we can LRU memoize this by executionId.
  const flowSteps = await Step.query()
    .where('flow_id', $.flow.id)
    .orderBy('position', 'asc')
    .throwIfNotFound()

  let currBranchStep: Partial<Step> = $.step

  // Only continue if step will require to update currBranchStep as the reference point
  if (onlyContinueIfFlag) {
    // search for immediate branch before current step
    currBranchStep = flowSteps
      .slice(0, $.step.position)
      .reverse()
      .find((step) => step.appKey === 'toolbox' && step.key === 'ifThen')

    // no branches so no next branch step to skip to
    if (!currBranchStep) {
      return null
    }
  }

  const currDepth = parseInt(currBranchStep.parameters?.depth as string)

  if (isNaN(currDepth)) {
    throw new Error(
      `Branch depth for ${
        onlyContinueIfFlag ? 'only continue if' : 'if then'
      } branch step ${currBranchStep.id} is not defined.`,
    )
  }

  // search for next branch after current step
  const nextBranchStep = flowSteps.slice($.step.position).find((step) => {
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
  return nextBranchStep?.['id']
}
