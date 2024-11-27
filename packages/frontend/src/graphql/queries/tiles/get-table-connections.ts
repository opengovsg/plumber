import { gql } from '@apollo/client'

export const GET_TABLE_CONNECTIONS = gql`
  query GetTableConnections($tableIds: [String!]!) {
    getTableConnections(tableIds: $tableIds)
  }
`
