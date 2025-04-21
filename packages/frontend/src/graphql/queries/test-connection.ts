import { gql } from '@apollo/client'

export const TEST_CONNECTION = gql`
  query TestConnection($connectionId: String!, $flowId: String) {
    testConnection(connectionId: $connectionId, flowId: $flowId) {
      connectionVerified
      registrationVerified
      message
    }
  }
`
