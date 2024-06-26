import { graphql } from '../__generated__/gql'

export const RETRY_EXECUTION_STEP = graphql(`
  mutation RetryExecutionStep($input: RetryExecutionStepInput) {
    retryExecutionStep(input: $input)
  }
`)
