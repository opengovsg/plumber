import { gql } from '@apollo/client'

export const TEST_CONNECTION = gql`
  query TestConnection(
    $connectionId: String!
    $flowId: String
    $supportsConnectionRegistration: Boolean
  ) {
    testConnection(
      connectionId: $connectionId
      flowId: $flowId
      supportsConnectionRegistration: $supportsConnectionRegistration
    ) {
      connectionVerified
      registrationVerified
      message
    }
  }
`
