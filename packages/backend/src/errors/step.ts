import { IStepError } from '@plumber/types'

export default class StepError extends Error {
  details = {}
  constructor(error: IStepError, options?: unknown) {
    const computedMessage = JSON.stringify(error)
    super(computedMessage, options)

    // for logging purposes
    this.details = error
  }
}
