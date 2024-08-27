import { gql } from '@apollo/client'

export const EXECUTE_FLOW = gql`
  mutation ExecuteFlow($input: ExecuteFlowInput) {
    executeFlow(input: $input) {
      id
      executionId
      status
      dataOut
      dataOutMetadata
      errorDetails
      stepId
      step {
        id
        status
      }
    }
  }
`
