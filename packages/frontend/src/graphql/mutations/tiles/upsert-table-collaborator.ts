import { graphql } from '@/graphql/__generated__'

export const UPSERT_TABLE_COLLABORATOR = graphql(`
  mutation UpsertTableCollaborator($input: TableCollaboratorInput!) {
    upsertTableCollaborator(input: $input)
  }
`)
