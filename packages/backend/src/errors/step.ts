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
