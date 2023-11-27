import { gql } from '@apollo/client'

export const GET_EXECUTION_STEPS = gql`
  query GetExecutionSteps($executionId: String!, $limit: Int!, $offset: Int!) {
    getExecutionSteps(
      executionId: $executionId
      limit: $limit
      offset: $offset
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
        }
      }
    }
  }
`
