import { graphql } from 'graphql/__generated__'

export const UPDATE_TABLE = graphql(`
  mutation UpdateTable($input: UpdateTableInput!) {
    updateTable(input: $input) {
      id
      columns {
        id
        name
      }
    }
  }
`)
