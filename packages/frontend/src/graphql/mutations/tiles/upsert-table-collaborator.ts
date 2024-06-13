import { gql } from '@apollo/client'

export const UPSERT_TABLE_COLLABORATOR = gql`
  mutation UpsertTableCollaborator($input: TableCollaboratorInput!) {
    upsertTableCollaborator(input: $input)
  }
`
