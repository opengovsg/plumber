import { graphql } from 'graphql/__generated__'

export const DELETE_TABLE = graphql(`
  mutation DeleteTable($input: DeleteTableInput!) {
    deleteTable(input: $input)
  }
`)
