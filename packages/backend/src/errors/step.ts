import { IJSONObject, IStepError, StepErrorKind } from '@plumber/types'

import HttpError from './http'

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
    // Unmigrated call sites can pass an undefined name from an API response body.
    const isPositional =
      typeof nameOrOptions !== 'object' || nameOrOptions === null
    const { name, solution, kind, cause } = isPositional
      ? {
          name: nameOrOptions as string,
          solution: solutionOrExtraProperties as string,
          kind: undefined,
          cause: positionalError,
        }
      : nameOrOptions
    const extraProperties = isPositional
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
