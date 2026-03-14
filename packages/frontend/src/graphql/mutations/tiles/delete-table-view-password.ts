import { graphql } from '@/graphql/__generated__'

export const DELETE_TABLE_VIEW_PASSWORD = graphql(`
  mutation DeleteTableViewPassword($tableId: ID!) {
    deleteTableViewPassword(tableId: $tableId)
  }
`)
