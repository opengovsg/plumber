import StepError, { type StepErrorOptions } from './step'

interface PartialStepErrorArgs extends StepErrorOptions {
  partialRetry: {
    buttonMessage: string
  }
}

/**
 * PartialStepError is an extension of StepError which allows for manual partial retries on the frontend
 * However, the worker will treat this as success and enqueue the next step in the flow
 */
export default class PartialStepError extends StepError {
  constructor(props: PartialStepErrorArgs) {
    const { partialRetry, ...options } = props
    super(options, { partialRetry })
  }
}
