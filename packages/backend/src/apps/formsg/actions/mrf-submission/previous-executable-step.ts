import type { IStep } from '@plumber/types'

// The minimal step shape this lookup reads. Real Objection `Step` rows satisfy
// it; unit-test fixtures pass partial plain objects.
export type MrfFlowStep = Partial<Pick<IStep, 'config'>> &
  Pick<IStep, 'id' | 'position'>

/**
 * The step whose completion lets the MRF step at `mrfStepPosition` continue: the
 * nearest step before it that is not part of a rejection branch. Rejection
 * branch steps (`config.approval`) only run when an earlier MRF step was
 * rejected, so they are never on the path into this one. Undefined when nothing
 * precedes it — a should-never-happen state the caller reports.
 *
 * This is purely positional. It does not mean the step definitely ran: it may
 * sit inside an if-then V2 block that a FALSE condition skipped, which is why
 * callers pair it with `getIfThenV2BlockSkipSteps`.
 */
export function findPreviousExecutableStep<FlowStep extends MrfFlowStep>(
  flowSteps: FlowStep[],
  mrfStepPosition: number,
): FlowStep | undefined {
  return flowSteps
    .filter((step) => step.position < mrfStepPosition && !step.config?.approval)
    .reduce<FlowStep | undefined>(
      (nearest, step) =>
        !nearest || step.position > nearest.position ? step : nearest,
      undefined,
    )
}
