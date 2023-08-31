import { gql } from '@apollo/client'

export const GET_EXECUTIONS = gql`
  query GetExecutions($limit: Int!, $offset: Int!, $status: String) {
    getExecutions(limit: $limit, offset: $offset, status: $status) {
      pageInfo {
        currentPage
        totalPages
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
