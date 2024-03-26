import { gql } from '@apollo/client'

export const MOCK_EXECUTE_FLOW = gql`
  mutation MockExecuteFlow($input: ExecuteFlowInput) {
    mockExecuteFlow(input: $input) {
      step {
        id
        status
        appKey
        executionSteps {
          id
          executionId
          stepId
          status
          dataOut
          dataOutMetadata
        }
      }
      data
    }
  }
`
