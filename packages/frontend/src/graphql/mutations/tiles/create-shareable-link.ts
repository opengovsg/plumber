import { graphql } from 'graphql/__generated__'

export const CREATE_SHAREABLE_TABLE_LINK = graphql(`
  mutation CreateShareableTableLink($tableId: ID!) {
    createShareableTableLink(tableId: $tableId)
  }
`)
