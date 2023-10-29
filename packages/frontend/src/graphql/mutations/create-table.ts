import { gql } from '@apollo/client'

export const CREATE_TABLE = gql`
  mutation CreateTable($input: CreateTableInput!) {
    createTable(input: $input) {
      id
      name
    }
  }
`
