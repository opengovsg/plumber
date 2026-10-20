import { IJSONObject, IStepError, StepErrorKind } from '@plumber/types'
import { z } from 'zod'

import HttpError from './http'

// A Record forces every StepErrorKind to appear here, and nothing else.
const STEP_ERROR_KINDS: Record<StepErrorKind, true> = {
  config: true,
  'third-party': true,
  internal: true,
}

const savedKindSchema = z.object({
  kind: z.enum(
    Object.keys(STEP_ERROR_KINDS) as [StepErrorKind, ...StepErrorKind[]],
  ),
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
  kind?: StepErrorKind
  cause?: HttpError
}

export default class StepError extends Error {
  readonly kind?: StepErrorKind

  constructor(
    options: StepErrorOptions,
    extraProperties?: Record<string, unknown>,
  )
  /** @deprecated Pass a `StepErrorOptions` object with a `kind` instead. */
  constructor(
    name: string,
    solution: string,
    error?: HttpError,
    extraProperties?: Record<string, unknown>,
  )
  constructor(
    nameOrOptions: string | StepErrorOptions,
    solutionOrExtraProperties?: string | Record<string, unknown>,
    positionalError?: HttpError,
    positionalExtraProperties?: Record<string, unknown>,
  ) {
    const { name, solution, kind, cause } =
      typeof nameOrOptions === 'string'
        ? {
            name: nameOrOptions,
            solution: solutionOrExtraProperties as string,
            kind: undefined,
            cause: positionalError,
          }
        : nameOrOptions
    const extraProperties =
      typeof nameOrOptions === 'string'
        ? positionalExtraProperties
        : (solutionOrExtraProperties as Record<string, unknown> | undefined)

    const stepError: IStepError = {
      name,
      solution,
      kind,
      details: cause?.details as IJSONObject,
      ...extraProperties,
    }
    const computedMessage = JSON.stringify(stepError)
    super(computedMessage, { cause })
    this.name = this.constructor.name
    this.kind = kind
  }
}

export function getStepErrorKind(error: unknown): StepErrorKind {
  if (error instanceof StepError) {
    // Unmigrated call sites have no kind yet, and an unknown cause counts as a Plumber bug.
    return error.kind ?? 'internal'
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
 * Lets `handleFailedJob` read the kind from the error that replaced the StepError.
 *
 * IMPORTANT: non-enumerable, so log redaction never walks into the StepError's HTTP cause.
 */
export function attachHiddenCauseIfStepError(
  target: Error,
  error: unknown,
): void {
  if (!(error instanceof StepError) || Object.hasOwn(target, 'cause')) {
    return
  }
  Object.defineProperty(target, 'cause', {
    value: error,
    enumerable: false,
    writable: true,
    configurable: true,
  })
}
