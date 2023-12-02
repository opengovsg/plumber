import { IBaseAction, IGlobalVariable } from '@plumber/types'

import HttpError from '@/errors/http'
import { applyJitter } from '@/helpers/backoff'
import { generateStepError } from '@/helpers/generate-step-error'
import logger from '@/helpers/logger'

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
export async function runWithM365RequestSafetyNet<T extends () => RunResult>(
  $: IGlobalVariable,
  run: T,
): RunResult
export async function runWithM365RequestSafetyNet<
  T extends () => TestRunResult,
>($: IGlobalVariable, run: T): TestRunResult
export async function runWithM365RequestSafetyNet<
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
    } else if (error instanceof HttpError && error.response.status === 429) {
      // A 429 response is considered a SEV-2+ incident for some tenants; log it
      // explicitly so that we can easily trigger incident creation from DD.
      logger.error('Received HTTP 429 from MS Graph', {
        event: 'ms-graph-http-429',
        tenant: $.auth?.data?.tenantKey as string,
        flowId: $.flow?.id,
        stepId: $.step?.id,
        executionId: $.execution?.id,
      })
    }

    throw error
  }
}
