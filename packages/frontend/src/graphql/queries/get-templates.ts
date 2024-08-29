import { gql } from '@apollo/client'

export const GET_TEMPLATES = gql`
  query GetTemplates($isDemoTemplate: Boolean!, $names: [String!]) {
    getTemplates(isDemoTemplate: $isDemoTemplate, names: $names) {
      id
      name
      description
      steps {
        position
        appKey
        eventKey
        sampleUrl
        parameters
      }
      iconName
    }
  }
`
