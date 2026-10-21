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
      createdAt
      connection {
        id
      }
      config {
        stepName
        endStepId
        templateConfig {
          appEventKey
        }
        approval {
          branch
          stepId
        }
      }
      flow {
        updatedAt
      }
    }
  }
`
