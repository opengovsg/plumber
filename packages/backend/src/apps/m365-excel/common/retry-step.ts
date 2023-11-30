import { IBaseAction, IGlobalVariable } from '@plumber/types'

/**
 * Internal to M365 actions only; this should never pop up in our logs for
 * published pipes.
 *
 * This is only used for non-fatal errors such as:
 * - Internal rate limiting
 * - er.... only internal rate limiting for now. <.<
 * - TBD: Microsoft expects semi-frequent 504 on some APIs; we may want to use
 *        this instead of our built in 504 retry.
 *
 * This basically signals to action.run() that it should retry itself by
 * returning next-step == self.
 */
export class M365RetryStepError extends Error {}

type RunResult = ReturnType<NonNullable<IBaseAction['run']>>
type TestRunResult = ReturnType<NonNullable<IBaseAction['testRun']>>

/**
 * Helper HOC
 */
export async function runWithM365Retry<T extends () => RunResult>(
  $: IGlobalVariable,
  run: T,
): RunResult
export async function runWithM365Retry<T extends () => TestRunResult>(
  $: IGlobalVariable,
  run: T,
): TestRunResult
export async function runWithM365Retry<
  T extends () => RunResult | TestRunResult,
>($: IGlobalVariable, run: T): RunResult | TestRunResult {
  try {
    return await run()
  } catch (error) {
    if (
      error instanceof M365RetryStepError &&
      // Don't retry on test runs to prevent holding the connection longer than
      // necessary; just error out and get user to manually retry.
      // TODO: A later PR will throw StepError; I want to add delay first.
      !$.execution.testRun
    ) {
      return {
        nextStep: {
          command: 'jump-to-step',
          stepId: $.step.id,
        },
      }
    }
    throw error
  }
}
