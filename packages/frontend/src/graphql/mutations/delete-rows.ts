import { gql } from '@apollo/client'

export const DELETE_ROWS = gql`
  mutation DeleteRows($input: DeleteTableRowsInput!) {
    deleteRows(input: $input)
  }
`
