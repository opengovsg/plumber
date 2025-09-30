import { gql } from '@apollo/client'

export const FLOW_FIELDS = gql`
  fragment DefaultFlowFields on Flow {
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
      createdAt
      connection {
        id
        verified
        createdAt
        formattedData {
          screenName
          env
        }
      }
      parameters
      config {
        stepName
        templateConfig {
          appEventKey
        }
      }
    }
    config {
      errorConfig {
        notificationFrequency
      }
      templateConfig {
        templateId
        formId
        tileId
      }
      showSurvey
      attachments {
        name
        displayedValue
        value
        size
        updatedAt
      }
    }
    pendingTransfer {
      id
      newOwner {
        id
        email
      }
    }
    template {
      demoVideoDetails {
        url
        title
      }
    }
    role
  }
`

export const GET_FLOW = gql`
  query GetFlow($id: String!) {
    getFlow(id: $id) {
      ...DefaultFlowFields
    }
  }
  ${FLOW_FIELDS}
`

export const GET_FLOW_WITH_COLLABORATORS = gql`
  query GetFlowWithCollaborators($id: String!) {
    getFlow(id: $id) {
      ...DefaultFlowFields
      collaborators {
        email
        role
      }
    }
  }
  ${FLOW_FIELDS}
`
