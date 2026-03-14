import { gql } from '@apollo/client'

export const GET_CONNECTED_APPS = gql`
  query GetConnectedApps {
    getConnectedApps {
      key
      name
      iconUrl
      docUrl
      primaryColor
      connectionCount
      flowCount
      auth {
        connectionType
      }
    }
  }
`
