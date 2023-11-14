import { gql } from '@apollo/client'

export const GET_TABLE = gql`
  query GetTable($tableId: String!) {
    getTable(tableId: $tableId) {
      id
      name
      columns {
        id
        name
        position
        config {
          width
        }
      }
    }
  }
`
