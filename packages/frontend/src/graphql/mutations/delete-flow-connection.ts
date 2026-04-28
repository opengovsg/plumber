import { graphql } from '@/graphql/__generated__'

export const DELETE_FLOW_CONNECTION = graphql(`
  mutation DeleteFlowConnection($input: DeleteFlowConnectionInput!) {
    deleteFlowConnection(input: $input)
  }
`)
