import { IJSONObject, IStepError } from '@plumber/types'

import HttpError from './http'

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
