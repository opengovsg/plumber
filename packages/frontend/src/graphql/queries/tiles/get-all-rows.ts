import { graphql } from '@/graphql/__generated__'

export const GET_ALL_ROWS = graphql(`
  query GetAllRows($tableId: String!, $stringifiedCursor: String) {
    getAllRows(tableId: $tableId, stringifiedCursor: $stringifiedCursor) {
      rows
      stringifiedCursor
    }
  }
`)
