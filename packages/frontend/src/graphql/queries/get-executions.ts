import { gql } from '@apollo/client'

export const GET_EXECUTIONS = gql`
  query GetExecutions(
    $limit: Int!
    $offset: Int!
    $status: String
    $searchInput: String
  ) {
    getExecutions(
      limit: $limit
      offset: $offset
      status: $status
      searchInput: $searchInput
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
