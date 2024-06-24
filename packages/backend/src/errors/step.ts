import { IJSONObject, IStepError } from '@plumber/types'

import HttpError from './http'

//
// Some generic solutions for common errors
//
export enum GenericSolution {
  ReconfigureInvalidField = 'Click on set up action and reconfigure the invalid field. Error could also result from the variables used in the field.',
}

export default class StepError extends Error {
  constructor(
    name: string,
    solution: string,
    position: number,
    appName: string,
    error?: HttpError,
    extraProperties?: Record<string, unknown>,
  ) {
    const stepError: IStepError = {
      name,
      solution,
      position,
      appName,
      details: error?.details as IJSONObject,
      ...extraProperties,
    }
    const computedMessage = JSON.stringify(stepError)
    super(computedMessage, { cause: error })
    this.name = this.constructor.name
  }
}
