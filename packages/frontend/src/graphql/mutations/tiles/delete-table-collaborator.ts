import { graphql } from 'graphql/__generated__'

export const DELETE_TABLE_COLLABORATOR = graphql(`
  mutation DeleteTableCollaborator($input: DeleteTableCollaboratorInput!) {
    deleteTableCollaborator(input: $input)
  }
`)
