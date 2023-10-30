import { IStepError } from '@plumber/types'

export default class StepError extends Error {
  details = {}
  constructor(error: IStepError) {
    const computedMessage = JSON.stringify(error)
    super(computedMessage)

    // for logging purposes
    this.details = error
  }
}
