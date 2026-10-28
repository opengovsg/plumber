import { gql } from '@apollo/client'

export const GET_TEMPLATES = gql`
  query GetTemplates($tag: TemplateTagType) {
    getTemplates(tag: $tag) {
      id
      name
      description
      steps {
        position
        appKey
        eventKey
        sampleUrl
        sampleUrlDescription
        parameters
        config {
          stepName
          endStepId
          approval {
            branch
            stepId
          }
        }
      }
      iconName
      tags
    }
  }
`
