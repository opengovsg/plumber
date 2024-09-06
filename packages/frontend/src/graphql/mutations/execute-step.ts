import { gql } from '@apollo/client'

export const EXECUTE_STEP = gql`
  mutation ExecuteStep($input: ExecuteStepInput) {
    executeStep(input: $input) {
      id
      executionId
      status
      dataOut
      dataOutMetadata
      errorDetails
      stepId
    }
  }
`
