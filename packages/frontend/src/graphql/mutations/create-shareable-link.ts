import { gql } from '@apollo/client'

export const CREATE_SHAREABLE_TABLE_LINK = gql`
  mutation CreateShareableTableLink($tableId: ID!) {
    createShareableTableLink(tableId: $tableId)
  }
`
