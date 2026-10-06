import { gql } from '@apollo/client'

export const GET_APP_CONNECTIONS = gql`
  query GetAppConnections($key: String!, $flowId: String) {
    getApp(key: $key, flowId: $flowId) {
      key
      auth {
        supportsConnectionEdit
      }
      connections {
        id
        key
        verified
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
