import { gql } from '@apollo/client'

export const DUPLICATE_FLOW = gql`
  mutation DuplicateFlow($input: DuplicateFlowInput) {
    duplicateFlow(input: $input) {
      id
      name
      active
      config {
        errorConfig {
          notificationFrequency
        }
        duplicateCount
      }
      steps {
        id
        key
        appKey
        webhookUrl
        status
        position
        connection {
          id
          verified
          createdAt
        }
        parameters
      }
    }
  }
`
