import { gql } from '@apollo/client'

export const GET_FLOW = gql`
  query GetFlow($id: String!) {
    getFlow(id: $id) {
      id
      name
      active
      steps {
        id
        type
        key
        appKey
        iconUrl
        webhookUrl
        status
        position
        connection {
          id
          verified
          createdAt
          formattedData {
            screenName
          }
        }
        parameters
        config {
          templateConfig {
            appEventKey
          }
        }
      }
      config {
        errorConfig {
          notificationFrequency
        }
        demoConfig {
          hasLoadedOnce
          videoId
        }
        templateConfig {
          templateId
          formId
          tileId
        }
      }
      pendingTransfer {
        id
        newOwner {
          id
          email
        }
      }
    }
  }
`
