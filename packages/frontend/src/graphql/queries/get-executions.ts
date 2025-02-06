import { gql } from '@apollo/client'

export const GET_EXECUTIONS = gql`
  query GetExecutions(
    $limit: Int!
    $offset: Int!
    $flowId: String!
    $status: String
  ) {
    getExecutions(
      limit: $limit
      offset: $offset
      flowId: $flowId
      status: $status
    ) {
      pageInfo {
        currentPage
        totalCount
      }
      edges {
        node {
          id
          testRun
          createdAt
          updatedAt
          status
          flow {
            id
            name
            active
            steps {
              iconUrl
            }
          }
        }
      }
    }
  }
`
