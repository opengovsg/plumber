import { gql } from '@apollo/client'

export const CREATE_TEMPLATED_FLOW = gql`
  mutation CreateTemplatedFlowInput($input: CreateTemplatedFlowInput) {
    createTemplatedFlow(input: $input) {
      id
      name
    }
  }
`
