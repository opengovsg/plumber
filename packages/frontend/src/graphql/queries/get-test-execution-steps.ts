import { gql } from '@apollo/client'

export const GET_TEST_EXECUTION_STEPS = gql`
  query GetTestExecutionSteps($flowId: String!) {
    getTestExecutionSteps(flowId: $flowId) {
      id
      executionId
      stepId
      step {
        id
        position
      }
      status
      appKey
      dataOut
      dataOutMetadata
      errorDetails
      metadata {
        isMock
      }
    }
  }
`
