import { graphql } from '@/graphql/__generated__'

export const DELETE_SHAREABLE_TABLE_LINK = graphql(`
  mutation DeleteShareableTableLink($tableId: ID!) {
    deleteShareableTableLink(tableId: $tableId)
  }
`)
