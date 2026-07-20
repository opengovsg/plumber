import type { IStep } from '@plumber/types'

// The minimal step shape this lookup reads, to enable unit tests to pass
// mocked objects instead of real Objection `Step`s.
export type MrfFlowStep = Partial<Pick<IStep, 'config'>> &
  Pick<IStep, 'id' | 'position'>

/**
 * Finds the pipe step ordered before an MRF submission sub-trigger.
 *
 * IMPORTANT: The returned step may not have actually executed: it may
 * sit inside an if-then V2 block that a FALSE condition. It is important to
 * pair this with `getParentConditionalSteps`.
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
