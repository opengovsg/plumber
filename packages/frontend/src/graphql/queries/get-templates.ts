import { gql } from '@apollo/client'

export const GET_TEMPLATES = gql`
  query GetTemplates {
    getTemplates {
      id
      name
      description
      steps {
        position
        templateId
        appKey
        eventKey
        sampleUrl
        parameters
      }
      iconName
    }
  }
`
