import { IStep } from '@plumber/types'

import { isIfThenStep } from '@/helpers/toolbox'

function findAdjacentSteps(
  steps: IStep[],
  position: number,
): {
  previousStep: IStep | undefined
  nextStep: IStep | undefined
} {
  return {
    previousStep: steps.find((s) => s.position === position - 1),
    nextStep: steps.find((s) => s.position === position + 1),
  }
}

/**
 * NOTE: this function checks if we should create an empty step.
 * The conditions are:
 * 1. The previous step is an if-then step and the next step is also an if-then step,
 *    which means that the step being deleted is the 'last' step in the if-then group
 * 2. The previous step is an if-then step and there is no next step,
 *    which means that the step being deleted is the 'last' step in the group
 * 3. The previous step is an if-then step whose step to jump to is the next
 *    step (i.e. the next step is the first step after the block), which means
 *    that the step being deleted is the branch's only step
 *
 * Without the placeholder a branch would end up empty, which the publish
 * constraint can't detect (an empty branch contributes no incomplete step).
 */
function shouldCreateEmptyStep(prev?: IStep, next?: IStep): boolean {
  return (
    isIfThenStep(prev) &&
    (!next || next.id === prev.parameters?.stepIdToJumpTo || isIfThenStep(next))
  )
}

export { findAdjacentSteps, shouldCreateEmptyStep }
