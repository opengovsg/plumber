import { gql } from '@apollo/client'

export const GET_APPS = gql`
  query GetApps(
    $name: String
    $onlyWithTriggers: Boolean
    $onlyWithActions: Boolean
  ) {
    getApps(
      name: $name
      onlyWithTriggers: $onlyWithTriggers
      onlyWithActions: $onlyWithActions
    ) {
      name
      key
      iconUrl
      docUrl
      authDocUrl
      primaryColor
      connectionCount
      description
      isNewApp
      category
      setupMessage {
        variant
        messageBody
      }
      demoVideoDetails {
        url
        title
      }
      auth
      triggers
      actions
    }
  }
`
