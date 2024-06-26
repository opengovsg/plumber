import { graphql } from 'graphql/__generated__'

export const CREATE_ROWS = graphql(`
  mutation CreateRows($input: CreateTableRowsInput!) {
    createRows(input: $input)
  }
`)
