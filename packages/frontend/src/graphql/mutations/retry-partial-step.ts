import { gql } from '@apollo/client'

export const RETRY_PARTIAL_STEP = gql`
  mutation RetryPartialStep($input: RetryPartialStepInput!) {
    retryPartialStep(input: $input)
  }
`
