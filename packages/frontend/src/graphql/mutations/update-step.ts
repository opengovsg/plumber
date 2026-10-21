import { graphql } from '@/graphql/__generated__'

export const UPDATE_STEP = graphql(`
  mutation UpdateStep($input: UpdateStepInput) {
    updateStep(input: $input) {
      id
      type
      key
      appKey
      webhookUrl
      parameters
      status
      position
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
`)
