import { gql } from '@apollo/client'

export const DELETE_TABLE_COLLABORATOR = gql`
  mutation DeleteTableCollaborator($input: DeleteTableCollaboratorInput!) {
    deleteTableCollaborator(input: $input)
  }
`
