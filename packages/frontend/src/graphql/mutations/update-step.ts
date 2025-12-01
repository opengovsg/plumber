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
      connection {
        id
      }
      config {
        stepName
        templateConfig {
          appEventKey
        }
      }
      flow {
        updatedAt
      }
    }
  }
`)
