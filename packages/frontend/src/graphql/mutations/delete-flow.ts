import { graphql } from 'graphql/__generated__'

export const DELETE_FLOW = graphql(`
  mutation DeleteFlow($input: DeleteFlowInput) {
    deleteFlow(input: $input)
  }
`)
