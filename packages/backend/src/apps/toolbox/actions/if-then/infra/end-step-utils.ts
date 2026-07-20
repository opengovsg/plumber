import type { IStep } from '@plumber/types'

import { isIfThenStep, type StepLike } from '../../../common/constants'

// Loose enough that unit tests can pass partial plain objects instead of full
// Step rows.
type ExtentStep = StepLike &
  Pick<IStep, 'id' | 'position'> &
  Partial<Pick<IStep, 'parameters'>>

// Mirrors getIfThenV1StepIdToSkipTo's depth defaulting; nesting never shipped,
// so this is dead-code defense.
function parseDepth(step: ExtentStep): number {
  const depth = parseInt(step.parameters?.depth as string)
  return isNaN(depth) ? 0 : depth
}

/**
 * Computes a V1 if-then block's derived extent (the last step, inclusive).
 *
 * IMPORTANT: this is a plain positional scan with no MRF awareness, so it can
 * derive an extent that crosses an mrfSubmission or a rejection-branch
 * boundary — region-confinement write validation is the safety net that
 * refuses to pin one that does.
 */
export function deriveIfThenV1EndStep<T extends ExtentStep>(
  flowSteps: T[],
  ifThenStep: T,
): T {
  const startIndex = flowSteps.findIndex((step) => step.id === ifThenStep.id)
  const currDepth = parseDepth(ifThenStep)

  const nextBoundaryIndex = flowSteps.findIndex(
    (step, index) =>
      index > startIndex && isIfThenStep(step) && parseDepth(step) <= currDepth,
  )

  if (nextBoundaryIndex === -1) {
    return flowSteps[flowSteps.length - 1]
  }
  return flowSteps[nextBoundaryIndex - 1]
}
