import { graphql } from '@/graphql/__generated__'

export const UPSERT_FLOW_COLLABORATOR = graphql(`
  mutation UpsertFlowCollaborator($input: FlowCollaboratorInput!) {
    upsertFlowCollaborator(input: $input)
  }
`)
