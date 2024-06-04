import HttpError from './http'
import StepError from './step'

interface PartialStepErrorArgs {
  name: string
  solution: string
  position: number
  appName: string
  partialRetry: {
    buttonMessage: string
  }
  error?: HttpError
}

/**
 * PartialStepError is an extension of StepError which allows for manual partial retries on the frontend
 * However, the worker will treat this as success and enqueue the next step in the flow
 */
export default class PartialStepError extends StepError {
  constructor(props: PartialStepErrorArgs) {
    const { name, solution, position, appName, error, partialRetry } = props
    super(name, solution, position, appName, error, { partialRetry })
  }
}
