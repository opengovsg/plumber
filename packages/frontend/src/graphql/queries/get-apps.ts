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
      substepLabels {
        connectionStepLabel
        settingsStepLabel
        addConnectionLabel
      }
      setupMessage {
        variant
        messageBody
      }
      demoVideoDetails {
        url
        title
      }
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
        settingsStepLabel
        setupMessage {
          variant
          messageBody
        }
        webhookTriggerInstructions {
          beforeUrlMsg
          afterUrlMsg
          errorMsg
          hideWebhookUrl
          mockDataMsg
        }
        helpMessage
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
            value
            showOptionValue
            hiddenIf {
              fieldKey
              fieldValue
              op
            }
            options {
              label
              description
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
              showOptionValue
              hiddenIf {
                fieldKey
                fieldValue
                op
              }
              options {
                label
                description
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
        settingsStepLabel
        setupMessage {
          variant
          messageBody
        }
        helpMessage
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
            showOptionValue
            value
            options {
              label
              description
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
            hiddenIf {
              fieldKey
              fieldValue
              op
            }
            addNewOption {
              id
              label
              type
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
              showOptionValue
              hiddenIf {
                fieldKey
                fieldValue
                op
              }
              addNewOption {
                id
                label
                type
              }
              options {
                label
                description
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
