import { IJSONObject, IStepError } from '@plumber/types'

import HttpError from './http'

//
// Some generic solutions for common errors
//
export enum GenericSolution {
  ReconfigureInvalidField = 'Click on set up action and reconfigure the invalid data field. Note that error could also result from the use of variables passed in the data field.',
}

export default class StepError extends Error {
  constructor(
    name: string,
    solution: string,
    position: number,
    appName: string,
    error?: HttpError,
  ) {
    const stepError: IStepError = {
      name,
      solution,
      position,
      appName,
      details: error?.details as IJSONObject,
    }
    const computedMessage = JSON.stringify(stepError)
    super(computedMessage, { cause: error })
    this.name = this.constructor.name
  }
}
