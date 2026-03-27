import { gql } from '@apollo/client'

export const CREATE_FLOW_WITH_STEPS = gql`
  mutation CreateFlowWithSteps($input: CreateFlowWithStepsInput) {
    createFlowWithSteps(input: $input) {
      id
      name
    }
  }
`
