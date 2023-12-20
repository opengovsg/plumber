import { gql } from '@apollo/client'

export const CREATE_ROWS = gql`
  mutation CreateRows($input: CreateTableRowsInput!) {
    createRows(input: $input)
  }
`
