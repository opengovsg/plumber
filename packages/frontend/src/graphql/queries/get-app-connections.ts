import { gql } from '@apollo/client'

export const GET_APP_CONNECTIONS = gql`
  query GetAppConnections(
    $key: String!
    $flowId: String
    $ensureDatabricksNew: Boolean
  ) {
    getApp(
      key: $key
      flowId: $flowId
      ensureDatabricksNew: $ensureDatabricksNew
    ) {
      key
      auth {
        supportsConnectionEdit
      }
      connections {
        id
        key
        verified
        generation
        flowCount
        editableLabel
        environment {
          id
          label
        }
        formattedData {
          screenName
          env
        }
        description
        createdAt
        updatedAt
      }
    }
  }
`
