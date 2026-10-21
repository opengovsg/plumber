import type { IStep } from '@plumber/types'

import {
  isStepInsideForEachBody,
  isStepInsideIfThenBlock,
} from '@/components/Editor/helpers/steps-utils'
import { isForEachStep } from '@/helpers/toolbox'

/**
 * Explicit override for the launchers whose anchor step does not reflect
 * where the new step actually lands relative to an if-then block.
 */
export type AnchorPlacement = 'inside-if-then-block' | 'after-if-then-block'

/**
 * Whether the new step will land inside an if-then block.
 *
 * `actionSteps` must be the MRF-filtered action-step list (trigger removed),
 * matching what `isStepInsideIfThenBlock` expects.
 */
export function isAnchorInsideIfThenBlock({
  anchorPlacement,
  anchorStep,
  actionSteps,
  groupingActions,
}: {
  anchorPlacement?: AnchorPlacement
  anchorStep?: IStep
  actionSteps: IStep[]
  groupingActions: Set<string>
}): boolean {
  if (anchorPlacement) {
    return anchorPlacement === 'inside-if-then-block'
  }
  if (!anchorStep) {
    return false
  }
  return isStepInsideIfThenBlock(anchorStep, actionSteps, groupingActions)
}

/**
 * Whether the new step will land inside a for-each body.
 *
 * A for-each has no bounded extent, so anchoring on the for-each step itself
 * counts as inside its body, same as anchoring on a step already inside it.
 */
export function isAnchorInsideForEachBody({
  anchorStep,
  actionSteps,
  groupingActions,
}: {
  anchorStep?: IStep
  actionSteps: IStep[]
  groupingActions: Set<string>
}): boolean {
  if (!anchorStep) {
    return false
  }
  return (
    isForEachStep(anchorStep) ||
    isStepInsideForEachBody(anchorStep, actionSteps, groupingActions)
  )
}
