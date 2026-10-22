import { gql } from '@apollo/client'

export const GET_FLOWS = gql`
  query GetFlows(
    $limit: Int!
    $offset: Int!
    $appKey: String
    $connectionId: String
    $name: String
    $active: Boolean
    $folderId: String
    $unfiled: Boolean
  ) {
    getFlows(
      limit: $limit
      offset: $offset
      appKey: $appKey
      connectionId: $connectionId
      name: $name
      active: $active
      folderId: $folderId
      unfiled: $unfiled
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
          steps {
            iconUrl
          }
          collaborators {
            email
            role
          }
          pendingTransfer {
            id
          }
          role
          folder {
            id
            name
            color
          }
        }
      }
    }
  }
`
