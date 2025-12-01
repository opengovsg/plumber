import { gql } from '@apollo/client'

export const CREATE_STEP = gql`
  mutation CreateStep($input: CreateStepInput) {
    createStep(input: $input) {
      id
      type
      key
      appKey
      parameters
      position
      status
      flowId
      connection {
        id
      }
      config {
        stepName
      }
      flow {
        updatedAt
      }
    }
  }
`
