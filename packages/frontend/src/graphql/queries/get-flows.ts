import { gql } from '@apollo/client'

export const GET_FLOWS = gql`
  query GetFlows(
    $limit: Int!
    $offset: Int!
    $appKey: String
    $connectionId: String
    $name: String
  ) {
    getFlows(
      limit: $limit
      offset: $offset
      appKey: $appKey
      connectionId: $connectionId
      name: $name
    ) {
      pageInfo {
        currentPage
        totalCount
      }
      edges {
        node {
          id
          name
          createdAt
          updatedAt
          active
          config {
            demoConfig {
              hasLoadedOnce
            }
          }
          steps {
            iconUrl
          }
          pendingTransfer {
            id
          }
        }
      }
    }
  }
`
