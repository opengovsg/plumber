import { gql } from '@apollo/client'

export const GET_ALL_ROWS = gql`
  query GetAllRows($tableId: String!) {
    getAllRows(tableId: $tableId)
  }
`
