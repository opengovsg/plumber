import { gql } from '@apollo/client'

export const GET_TABLE_CONNECTIONS = gql`
  query GetTableConnections($limit: Int!, $offset: Int!, $name: String) {
    getTableConnections(limit: $limit, offset: $offset, name: $name)
  }
`
