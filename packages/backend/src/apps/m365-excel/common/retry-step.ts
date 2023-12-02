import { IBaseAction, IGlobalVariable } from '@plumber/types'

import { applyJitter } from '@/helpers/backoff'
import { generateStepError } from '@/helpers/generate-step-error'

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
export class M365RetryStepError extends Error {
  private retryAfterMsValue: number

  constructor(message: string, retryAfterMs: number, options?: ErrorOptions) {
    super(message, options)
    this.retryAfterMsValue = retryAfterMs
  }

  get retryAfterMs(): number {
    return this.retryAfterMsValue
  }
}

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
    if (error instanceof M365RetryStepError) {
      // Don't retry on test runs to prevent holding the connection longer than
      // necessary; just error out and get user to manually retry.
      if ($.execution.testRun) {
        throw generateStepError(
          error.message,
          `Retry again in ${Math.ceil(error.retryAfterMs)} seconds`,
          $.step.position,
          $.app.name,
        )
      } else {
        return {
          nextStep: {
            command: 'jump-to-step',
            stepId: $.step.id,
          },
          nextStepDelayMs: applyJitter(error.retryAfterMs),
        }
      }
    }
    throw error
  }
}
