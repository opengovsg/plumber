import { gql } from '@apollo/client'

export const GET_TABLES = gql`
  query GetTables($limit: Int!, $offset: Int!, $name: String) {
    getTables(limit: $limit, offset: $offset, name: $name) {
      pageInfo {
        currentPage
        totalCount
      }
      edges {
        node {
          id
          name
          lastAccessedAt
          role
        }
      }
    }
  }
`
