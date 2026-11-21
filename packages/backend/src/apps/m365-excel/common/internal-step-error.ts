import type { IGlobalVariable } from '@plumber/types'
import { z } from 'zod'

import StepError from '@/errors/step'
import logger from '@/helpers/logger'

// A ZodError message is a raw JSON array of issues, which users cannot read.
function describeError(error: unknown): string {
  if (error instanceof z.ZodError) {
    return z.prettifyError(error)
  }
  return error instanceof Error ? error.message : String(error)
}

/**
 * Wraps an unexpected error without hiding its message from the user or from logs.
 *
 * IMPORTANT: the StepError cause is non-enumerable, so logs and errorDetails would otherwise lose it.
 */
export function toInternalStepError(
  $: IGlobalVariable,
  error: unknown,
  { name, event }: { name: string; event: string },
): StepError {
  const message = describeError(error)
  logger.error(name, {
    event,
    errorName: error instanceof Error ? error.name : typeof error,
    errorMessage: message,
    flowId: $.flow?.id,
    stepId: $.step?.id,
    executionId: $.execution?.id,
  })
  return new StepError(
    {
      name,
      solution:
        'This should not happen. Please contact [Plumber support](https://go.gov.sg/plumber-support) for assistance.',
      kind: 'internal',
      cause: error,
    },
    { details: { error: message } },
  )
}
