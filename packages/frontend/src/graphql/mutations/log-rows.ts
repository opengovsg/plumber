import { gql } from '@apollo/client'

export const LOG_ROWS = gql`
  mutation LogRows($input: CreateTableRowsInput!) {
    logRows(input: $input)
  }
`
