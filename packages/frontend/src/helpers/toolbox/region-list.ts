import { type IStep } from '@plumber/types'

import { isForEachStep } from './for-each'
import { extractBranchesWithSteps, isIfThenStep } from './if-then'

//
// Region list
//
// Models a flow's action steps (i.e. everything after the trigger) as an
// ordered list of regions, so that single steps can appear after — and between
// — if-then blocks. A `SingleSteps` region is a run of ordinary steps; a `Block`
// region is a chain of if-then branches (or a for-each). See the hidden
// `stepIdToJumpTo` parameter on if-then for how block membership is stored.
//
export type StepRegion =
  | { type: 'SingleSteps'; steps: IStep[] }
  | { type: 'Block'; branches: IStep[][] }

function isGroupingStep(step: IStep, groupingActions: Set<string>): boolean {
  return (
    !!step.appKey &&
    !!step.key &&
    groupingActions.has(`${step.appKey}-${step.key}`)
  )
}

/**
 * Follows the `stepIdToJumpTo` chain from an if-then block's first branch to
 * find the index just past the block (its exit). A branch whose target is
 * another if-then continues the block; a branch whose target is a single step
 * ends it there. Returns `actionSteps.length` when the block runs to the end of
 * the flow (last branch's target absent, or a dangling/backward target).
 */
function findIfThenBlockExitIndex(
  actionSteps: IStep[],
  startIndex: number,
  idToIndex: Map<string, number>,
): number {
  const visited = new Set<string>()
  let current = actionSteps[startIndex]
  let target = current.parameters?.stepIdToJumpTo

  while (typeof target === 'string' && !visited.has(current.id)) {
    visited.add(current.id)
    const targetIndex = idToIndex.get(target)
    const targetStep =
      targetIndex === undefined ? undefined : actionSteps[targetIndex]

    // Target is another if-then => it's the next branch; keep extending.
    if (isIfThenStep(targetStep)) {
      current = targetStep
      target = targetStep.parameters?.stepIdToJumpTo
      continue
    }

    // Target is a single step after the block => the block exits there.
    if (targetIndex !== undefined && targetIndex > startIndex) {
      return targetIndex
    }

    // Dangling or backward target: treat the block as running to the end.
    return actionSteps.length
  }

  // No (further) target => block runs to the end of the flow.
  return actionSteps.length
}

/**
 * Models the flow's action steps (steps after the trigger) as an ordered region
 * list. Runs of ordinary steps become `SingleSteps` regions; if-then chains and
 * for-each groups become `Block` regions.
 *
 * Legacy flows lack `stepIdToJumpTo`, so an if-then block runs to the end of the
 * flow (consecutive if-thens = one block) — byte-identical to the previous
 * "group is always last" behaviour. For-each likewise stays a last-step group.
 *
 * The list always begins with a `SingleSteps` region (the steps before the
 * first block, possibly empty) so that a block-first flow renders exactly as
 * before. Otherwise no empty regions are emitted (blocks are separated by >= 1
 * single step, so between-block regions are never empty).
 */
export function buildRegionList(
  actionSteps: IStep[],
  groupingActions: Set<string>,
): StepRegion[] {
  const regions: StepRegion[] = []
  const idToIndex = new Map(actionSteps.map((step, index) => [step.id, index]))

  let singleSteps: IStep[] = []
  // The leading region is always emitted (even if empty); later empty runs are
  // not.
  let isLeadingRegion = true
  const flushSingleSteps = () => {
    if (singleSteps.length > 0 || isLeadingRegion) {
      regions.push({ type: 'SingleSteps', steps: singleSteps })
      singleSteps = []
    }
    isLeadingRegion = false
  }

  let i = 0
  while (i < actionSteps.length) {
    const step = actionSteps[i]

    if (!isGroupingStep(step, groupingActions)) {
      singleSteps.push(step)
      i++
      continue
    }

    // A grouping action starts a Block. The accumulated single steps (the
    // leading region may be empty, mirroring the previous "steps before group")
    // become their own region first.
    flushSingleSteps()

    // For-each stays a last-step group, and a legacy if-then (one with no
    // stored stepIdToJumpTo key) runs to the end of the flow. Otherwise follow
    // the chain to find the exit.
    const isLegacyIfThen =
      isIfThenStep(step) &&
      !Object.hasOwn(step.parameters ?? {}, 'stepIdToJumpTo')
    const exitIndex =
      isForEachStep(step) || isLegacyIfThen
        ? actionSteps.length
        : findIfThenBlockExitIndex(actionSteps, i, idToIndex)

    regions.push({
      type: 'Block',
      branches: extractBranchesWithSteps(actionSteps.slice(i, exitIndex), 0),
    })
    i = exitIndex
  }

  // Flush any trailing single steps (and the leading region for a flow that has
  // no blocks at all, including a flow with no action steps).
  flushSingleSteps()

  return regions
}

/**
 * Whether the given step sits inside an if-then branch — it's the branch's
 * if-then or one of the branch's steps. Used to stop if-thens from nesting:
 * the add-step modal must not offer if-then when it is anchored at a step
 * inside a branch. Checked per branch (not per block) so that if-then branches
 * nested inside a for-each block also count, while the for-each's own body
 * steps don't (if-then remains selectable there).
 */
export function isStepWithinIfThenBlock(
  regions: StepRegion[],
  stepId?: string,
): boolean {
  if (!stepId) {
    return false
  }
  return regions.some(
    (region) =>
      region.type === 'Block' &&
      region.branches.some(
        (branch) =>
          isIfThenStep(branch[0]) && branch.some((step) => step.id === stepId),
      ),
  )
}

/**
 * Whether the given step sits inside a for-each block (including inside an
 * if-then nested within it). The for-each content doesn't render regions, so
 * a mid-body if-then would wrongly absorb the body steps after it — if-then
 * stays last-step-only inside a for-each.
 */
export function isStepWithinForEachBlock(
  regions: StepRegion[],
  stepId?: string,
): boolean {
  if (!stepId) {
    return false
  }
  return regions.some(
    (region) =>
      region.type === 'Block' &&
      isForEachStep(region.branches[0]?.[0]) &&
      region.branches.some((branch) =>
        branch.some((step) => step.id === stepId),
      ),
  )
}
