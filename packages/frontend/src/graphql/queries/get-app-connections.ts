import { gql } from '@apollo/client'

export const GET_APP_CONNECTIONS = gql`
  query GetAppConnections($key: String!, $flowId: String) {
    getApp(key: $key, flowId: $flowId) {
      key
      connections {
        id
        key
        verified
        flowCount
        formattedData {
          screenName
          env
        }
        createdAt
      }
    }
  }
`
