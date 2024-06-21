import { graphql } from '../__generated__/gql'

export const GET_APP_CONNECTIONS = graphql(`
  query GetAppConnections($key: String!) {
    getApp(key: $key) {
      key
      connections {
        id
        key
        verified
        flowCount
        formattedData {
          screenName
        }
        createdAt
      }
    }
  }
`)
