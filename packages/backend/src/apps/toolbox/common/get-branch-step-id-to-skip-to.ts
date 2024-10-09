import type { IGlobalVariable, IStep } from '@plumber/types'

import Step from '@/models/step'

export async function getBranchStepIdToSkipTo(
  $: IGlobalVariable,
): Promise<IStep['id']> {
  // PERF-FIXME: Objectionjs does no caching, so this will almost always be
  // queried multiple times by the same worker during a test run. If it does
  // turn out to impact perf, we can LRU memoize this by executionId.
  const flowSteps = await Step.query()
    .where('flow_id', $.flow.id)
    .orderBy('position', 'asc')
    .throwIfNotFound()

  // search for immediate branch before current step
  const currBranchStep = flowSteps
    .slice(0, $.step.position) // position is 1-indexed so if-then takes current step by default
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
  return nextBranchStep?.id
}
