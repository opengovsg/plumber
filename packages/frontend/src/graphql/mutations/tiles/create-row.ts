import { gql } from '@apollo/client'

export const CREATE_ROW = gql`
  mutation CreateRow($input: CreateTableRowInput!) {
    createRow(input: $input)
  }
`
