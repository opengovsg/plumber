import type { IJSONObject, IStep } from '@plumber/types'

import {
  BLOCK_END_STEP_ID,
  isIfThenStep,
  isIfThenV2,
  isOnlyContinueIfStep,
} from './constants'

// The minimal step shape block geometry reads: the predicates need appKey/key/
// config, and the range arithmetic needs id/position. Real Objection `Step` rows
// satisfy it; unit-test fixtures pass partial plain objects.
export type BlockScopedStep = Partial<
  Pick<IStep, 'appKey' | 'key' | 'config'>
> &
  Pick<IStep, 'id' | 'position'>

// The minimal execution-step shape needed to tell whether a conditional step
// skipped. Real `ExecutionStep` rows satisfy it.
export interface ConditionalExecutionRecord {
  isFailed?: boolean
  dataOut?: IJSONObject | null
}

/**
 * The if-then V2 block whose range `(ifThen, endStep]` contains `step`, or null
 * when it sits outside every block. Blocks are depth-0 and pairwise disjoint, so
 * at most one contains it. A dangling or before-self marker resolves no range —
 * execution throws on those (`resolveEndStepOrThrow`); here they simply enclose
 * nothing.
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
 * The conditional steps whose FALSE result makes execution resume *after* the
 * if-then V2 block that contains `step` — so a later step in the flow can be
 * reached without `step` ever running. Empty when `step` sits outside every
 * block: nothing can then skip over it, and its own execution record is the only
 * evidence that execution reached it.
 *
 * The block's own if-then is included — a FALSE condition jumps straight past
 * the endStep — as is every only-continue-if inside it, which aborts the
 * remainder of the block the same way. The if-then is not inside its own block,
 * so an empty (self-referencing) block yields nothing.
 */
export function getIfThenV2BlockSkipSteps(
  flowSteps: BlockScopedStep[],
  step: BlockScopedStep,
): BlockScopedStep[] {
  const block = findEnclosingIfThenV2Block(flowSteps, step)
  if (!block) {
    return []
  }

  return flowSteps
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
 * i.e. its condition was FALSE. Reads the dataOut its action writes: if-then
 * `{ isConditionMet }`, only-continue-if `{ result }`. Any other step type, a
 * failed run, or a run that has not happened yet is false.
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
