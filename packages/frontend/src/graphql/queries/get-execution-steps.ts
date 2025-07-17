import { gql } from '@apollo/client'

export const GET_EXECUTION_STEPS = gql`
  query GetExecutionSteps(
    $executionId: String!
    $limit: Int!
    $offset: Int!
    $iteration: Int
  ) {
    getExecutionSteps(
      executionId: $executionId
      limit: $limit
      offset: $offset
      iteration: $iteration
    ) {
      pageInfo {
        currentPage
        totalCount
      }
      edges {
        node {
          id
          executionId
          status
          dataIn
          dataOut
          errorDetails
          createdAt
          updatedAt
          jobId
          appKey
          key
          metadata {
            iteration
            iterations
            isLastIteration
            iterationStatus
            isLastStep
          }
        }
      }
    }
  }
`
