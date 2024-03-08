import { gql } from '@apollo/client'

export const UPDATE_FLOW_CONFIG = gql`
  mutation UpdateFlowConfig($input: UpdateFlowConfigInput) {
    updateFlowConfig(input: $input) {
      id
      config {
        errorConfig {
          notificationFrequency
        }
      }
    }
  }
`
