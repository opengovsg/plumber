import { gql } from '@apollo/client'

export const UPDATE_ROW = gql`
  mutation UpdateRow($input: UpdateTableRowInput!) {
    updateRow(input: $input)
  }
`
