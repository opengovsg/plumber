import { IJSONObject, IStepError } from '@plumber/types'

import HttpError from './http'

//
// Some generic solutions for common errors
//
export enum GenericSolution {
  ReconfigureInvalidField = 'Click on set up action and reconfigure the invalid field. Error could also result from the variables used in the field.',
}

export default class IntermediateStepError extends Error {
  solution: string
  error?: HttpError
  extraProperties?: Record<string, unknown>

  constructor(
    name: string,
    solution: string,
    error?: HttpError,
    extraProperties?: Record<string, unknown>,
  ) {
    const stepError: Partial<IStepError> = {
      name,
      solution,
      details: error?.details as IJSONObject,
      ...extraProperties,
    }
    const computedMessage = JSON.stringify(stepError)
    super(computedMessage, { cause: error })
    this.solution = solution
    this.error = error
    this.extraProperties = extraProperties
    this.name = name
  }
}
