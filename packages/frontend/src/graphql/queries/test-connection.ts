import { gql } from '@apollo/client'

export const TEST_CONNECTION = gql`
  query TestConnection($connectionId: String!, $stepId: String) {
    testConnection(connectionId: $connectionId, stepId: $stepId) {
      connectionVerified
      registrationVerified
      message
    }
  }
`
