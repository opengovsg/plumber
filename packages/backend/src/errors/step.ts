import { IJSONObject, IStepError, StepErrorKind } from '@plumber/types'
import { z } from 'zod'

import RetriableError from './retriable-error'

const savedKindSchema = z.object({
  kind: z.enum(['config', 'third-party', 'internal']),
})

//
// Some generic solutions for common errors
//
export enum GenericSolution {
  ReconfigureInvalidField = 'Reconfigure the invalid field and try again. Error could also result from the variables used in the field.',
  MalformedConnectionData = 'Please reconnect and try again.',
}

export interface StepErrorOptions {
  name: string
  solution: string
  kind: StepErrorKind
  // Not always an HttpError: SDK errors (e.g. SES) are kept so their kind can still be classified.
  cause?: unknown
}

export default class StepError extends Error {
  readonly kind: StepErrorKind

  constructor(
    { name, solution, kind, cause }: StepErrorOptions,
    extraProperties?: Record<string, unknown>,
  ) {
    const stepError: IStepError = {
      name,
      solution,
      kind,
      details: (typeof cause === 'object' &&
      cause !== null &&
      'details' in cause
        ? cause.details
        : undefined) as IJSONObject,
      ...extraProperties,
    }
    const computedMessage = JSON.stringify(stepError)
    super(computedMessage, { cause })
    this.name = this.constructor.name
    this.kind = kind
  }
}

export function getStepErrorKind(error: unknown): StepErrorKind {
  if (error instanceof StepError || error instanceof RetriableError) {
    return error.kind
  }
  return 'internal'
}

/**
 * Reads the kind a StepError saved into `errorDetails`, for end points that hold no error object.
 */
export function getErrorDetailsKind(errorDetails: unknown): StepErrorKind {
  const result = savedKindSchema.safeParse(errorDetails)
  return result.success ? result.data.kind : 'internal'
}

/**
 * Lets `handleFailedJob` read the kind of an error that another error replaced.
 *
 * IMPORTANT: non-enumerable, so log redaction never walks into the StepError's HTTP cause.
 */
export function keepErrorKindViaCause(target: Error, error: unknown): void {
  const carriesKind =
    error instanceof StepError || error instanceof RetriableError
  if (!carriesKind || Object.hasOwn(target, 'cause')) {
    return
  }
  Object.defineProperty(target, 'cause', {
    value: error,
    enumerable: false,
    writable: true,
    configurable: true,
  })
}
