import type { IStep } from '@plumber/types'

import { isIfThenStep, type StepLike } from '../../../common/constants'

// StepLike (appKey/key/config, all optional) plus the fields the extent scan
// needs directly: id/position (used unconditionally) and parameters (depth,
// read defensively). Real Objection `Step` rows satisfy it, and unit tests can
// pass partial plain objects.
type ExtentStep = StepLike &
  Pick<IStep, 'id' | 'position'> &
  Partial<Pick<IStep, 'parameters'>>

// Mirrors the depth handling in getIfThenV1StepIdToSkipTo: a missing/garbled
// depth defaults to 0 (nesting never shipped, so this is inert defense).
function parseDepth(step: ExtentStep): number {
  const depth = parseInt(step.parameters?.depth as string)
  return isNaN(depth) ? 0 : depth
}

/**
 * Computes a V1 (legacy, marker-less) if-then block's derived extent — the last
 * step (inclusive) inside the block — as a pure function of the flow's steps.
 * Mirrors the forward scan in `getIfThenV1StepIdToSkipTo`: the extent runs up to
 * the step just before the next if-then at `depth <=` the block's own depth,
 * else to the end of the flow. An empty block (the next if-then immediately
 * follows) resolves to the if-then itself (self-reference).
 *
 * Used by create-step's server-side lazy-upgrade pin. The scan is plain
 * positional order and knows nothing of MRF structure, so a derived extent can
 * run past an mrfSubmission or out of a rejection branch; region-confinement
 * write validation is the safety net that refuses to pin one that does.
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
