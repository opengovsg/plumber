import { gql } from '@apollo/client'

export const DELETE_TABLE = gql`
  mutation DeleteTable($input: DeleteTableInput!) {
    deleteTable(input: $input)
  }
`
