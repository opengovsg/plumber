import { graphql } from 'graphql/__generated__'

export const DELETE_ROWS = graphql(`
  mutation DeleteRows($input: DeleteTableRowsInput!) {
    deleteRows(input: $input)
  }
`)
