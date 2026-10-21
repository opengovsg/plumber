import type { IJSONObject, IStep } from '@plumber/types'

import {
  BLOCK_END_STEP_ID,
  isIfThenStep,
  isIfThenV2,
  isOnlyContinueIfStep,
} from './constants'

// Minimal shape so unit-test fixtures can pass plain objects instead of real
// Objection Step rows.
export type BlockScopedStep = Partial<
  Pick<IStep, 'appKey' | 'key' | 'config'>
> &
  Pick<IStep, 'id' | 'position'>

// Minimal shape so unit-test fixtures can pass plain objects instead of real
// ExecutionStep rows.
export interface ConditionalExecutionRecord {
  isFailed?: boolean
  dataOut?: IJSONObject | null
}

/**
 * The if-then V2 block whose range `(ifThen, endStep]` contains `step`, or null
 * if none does. Blocks are depth-0 and pairwise disjoint, so at most one match
 * is possible.
 */
function findEnclosingIfThenV2Block(
  flowSteps: BlockScopedStep[],
  step: BlockScopedStep,
): { ifThenStep: BlockScopedStep; endStep: BlockScopedStep } | null {
  for (const candidate of flowSteps) {
    if (!isIfThenV2(candidate) || candidate.position >= step.position) {
      continue
    }
    const endStep = flowSteps.find(
      (flowStep) => flowStep.id === candidate.config?.[BLOCK_END_STEP_ID],
    )
    if (endStep && step.position <= endStep.position) {
      return { ifThenStep: candidate, endStep }
    }
  }
  return null
}

/**
 * The if-then and only-continue-if steps guarding the if-then V2 block that
 * contains `step`. Typically passed to `didConditionalStepSkip` next, to check
 * whether `step` was actually skipped rather than run.
 */
export function getParentConditionalSteps(
  allFlowSteps: BlockScopedStep[],
  step: BlockScopedStep,
): BlockScopedStep[] {
  const block = findEnclosingIfThenV2Block(allFlowSteps, step)
  if (!block) {
    return []
  }

  return allFlowSteps
    .filter(
      (flowStep) =>
        flowStep.id === block.ifThenStep.id ||
        (isOnlyContinueIfStep(flowStep) &&
          flowStep.position > block.ifThenStep.position &&
          flowStep.position <= block.endStep.position),
    )
    .sort((first, second) => first.position - second.position)
}

/**
 * True when this conditional step's recorded run resolved a step to jump to,
 * i.e. its condition was FALSE. Reads the dataOut its own action writes:
 * if-then `{ isConditionMet }`, only-continue-if `{ result }`.
 */
export function didConditionalStepSkip(
  step: BlockScopedStep,
  executionStep: ConditionalExecutionRecord | null | undefined,
): boolean {
  if (!executionStep || executionStep.isFailed) {
    return false
  }
  if (isIfThenStep(step)) {
    return executionStep.dataOut?.isConditionMet === false
  }
  if (isOnlyContinueIfStep(step)) {
    return executionStep.dataOut?.result === false
  }
  return false
}
