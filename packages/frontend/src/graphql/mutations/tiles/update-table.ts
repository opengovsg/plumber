import { gql } from '@apollo/client'

export const UPDATE_TABLE = gql`
  mutation UpdateTable($input: UpdateTableInput!) {
    updateTable(input: $input) {
      id
    }
  }
`
