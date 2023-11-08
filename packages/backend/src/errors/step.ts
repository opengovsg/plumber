import { IStepError } from '@plumber/types'

export default class StepError extends Error {
  constructor(error: IStepError, options?: ErrorOptions) {
    const computedMessage = JSON.stringify(error)
    super(computedMessage, options)
    this.name = this.constructor.name
  }
}
