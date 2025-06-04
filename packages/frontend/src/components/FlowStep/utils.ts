import { IStep } from '@plumber/types'

import { isForEachStep, isIfThenStep } from '@/helpers/toolbox'

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
 * This applies to if-then and for-each groups.
 * The conditions are:
 * 1. The previous step is an if-then step and the next step is also an if-then step,
 *    which means that the step being deleted is the 'last' step in the if-then group
 * 2. The previous step is an if-then step and there is no next step,
 *    which means that the step being deleted is the 'last' step in the group
 * 3. The previous step is a for-each step and there is no next step
 */
function shouldCreateEmptyStep(prev?: IStep, next?: IStep): boolean {
  if (!prev) {
    return false
  }

  // Condition 1: Previous is if-then AND next is if-then
  if (isIfThenStep(prev) && next && isIfThenStep(next)) {
    return true
  }

  // Condition 2: Previous is if-then AND no next step
  if (isIfThenStep(prev) && !next) {
    return true
  }

  // Condition 3: Previous is for-each AND no next step
  if (isForEachStep(prev) && !next) {
    return true
  }

  return false
}

export { findAdjacentSteps, shouldCreateEmptyStep }
