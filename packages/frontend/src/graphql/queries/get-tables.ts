import { gql } from '@apollo/client'

export const GET_TABLES = gql`
  query GetTables {
    getTables {
      id
      name
      columns {
        id
        name
      }
    }
  }
`
