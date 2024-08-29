import { gql } from '@apollo/client'

export const GET_TEMPLATE = gql`
  query GetTemplate($isDemoTemplate: Boolean!, $id: String!) {
    getTemplate(isDemoTemplate: $isDemoTemplate, id: $id) {
      id
      name
      description
      steps {
        position
        templateId
        appKey
        eventKey
        sampleUrl
        sampleUrlDescription
        parameters
      }
    }
  }
`
