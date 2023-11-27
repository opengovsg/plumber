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
      auth {
        connectionType
        connectionRegistrationType
        fields {
          key
          label
          type
          required
          readOnly
          value
          placeholder
          description
          docUrl
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
      triggers {
        name
        key
        type
        pollInterval
        description
        webhookTriggerInstructions {
          beforeUrlMsg
          afterUrlMsg
          errorMsg
          hideWebhookUrl
        }
        substeps {
          key
          name
          arguments {
            label
            key
            type
            required
            description
            placeholder
            variables
            variableTypes
            allowArbitrary
            dependsOn
            showOptionValue
            options {
              label
              value
            }
            source {
              type
              name
              arguments {
                name
                value
              }
            }
            # Only for multi-row
            subFields {
              label
              key
              type
              required
              description
              placeholder
              variables
              variableTypes
              allowArbitrary
              dependsOn
              showOptionValue
              options {
                label
                value
              }
              source {
                type
                name
                arguments {
                  name
                  value
                }
              }
            }
          }
        }
      }
      actions {
        name
        key
        description
        groupsLaterSteps
        substeps {
          key
          name
          arguments {
            label
            key
            type
            required
            description
            placeholder
            variables
            variableTypes
            allowArbitrary
            dependsOn
            hidden
            showOptionValue
            options {
              label
              value
            }
            source {
              type
              name
              arguments {
                name
                value
              }
            }
            # Only for multi-row
            subFields {
              label
              key
              type
              required
              description
              placeholder
              variables
              variableTypes
              allowArbitrary
              dependsOn
              showOptionValue
              options {
                label
                value
              }
              source {
                type
                name
                arguments {
                  name
                  value
                }
              }
            }
          }
        }
      }
    }
  }
`
