import { graphql } from 'graphql/__generated__'

export const CREATE_FLOW = graphql(`
  mutation CreateFlow($input: CreateFlowInput!) {
    createFlow(input: $input) {
      id
      name
    }
  }
`)
