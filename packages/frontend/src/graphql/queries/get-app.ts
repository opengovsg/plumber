import { gql } from '@apollo/client'

export const GET_APP = gql`
  query GetApp($key: String!) {
    getApp(key: $key) {
      name
      key
      iconUrl
      docUrl
      authDocUrl
      primaryColor
      supportsConnections
      auth {
        fields {
          key
          label
          type
          required
          readOnly
          value
          description
          docUrl
          allowArbitrary
          clickToCopy
          autoComplete
          options {
            label
            value
          }
        }
        authenticationSteps {
          type
          name
          arguments {
            name
            value
            type
            properties {
              name
              value
            }
          }
        }
        reconnectionSteps {
          type
          name
          arguments {
            name
            value
            type
            properties {
              name
              value
            }
          }
        }
      }
      connections {
        id
      }
      triggers {
        name
        key
        type
        pollInterval
        description
        webhookTriggerTexts
        substeps {
          name
        }
      }
      actions {
        name
        key
        description
        substeps {
          name
        }
      }
    }
  }
`
