import { graphql } from 'graphql/__generated__'

export const CREATE_ROW = graphql(`
  mutation CreateRow($input: CreateTableRowInput!) {
    createRow(input: $input)
  }
`)
