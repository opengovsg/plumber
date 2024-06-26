import { graphql } from 'graphql/__generated__'

export const CREATE_TABLE = graphql(`
  mutation CreateTable($input: CreateTableInput!) {
    createTable(input: $input) {
      id
      name
    }
  }
`)
