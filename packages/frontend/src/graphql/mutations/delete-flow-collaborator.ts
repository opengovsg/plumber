import { graphql } from '@/graphql/__generated__'

export const DELETE_FLOW_COLLABORATOR = graphql(`
  mutation DeleteFlowCollaborator($input: DeleteFlowCollaboratorInput!) {
    deleteFlowCollaborator(input: $input)
  }
`)
