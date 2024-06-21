import { graphql } from '../__generated__/gql'

export const GET_CONNECTED_APPS = graphql(`
  query GetConnectedApps($name: String) {
    getConnectedApps(name: $name) {
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
`)
