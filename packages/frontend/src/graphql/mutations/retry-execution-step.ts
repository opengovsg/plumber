import { gql } from '@apollo/client'

export const RETRY_EXECUTION_STEP = gql`
  mutation RetryExecutionStep($input: RetryExecutionStepInput) {
    retryExecutionStep(input: $input)
  }
`
