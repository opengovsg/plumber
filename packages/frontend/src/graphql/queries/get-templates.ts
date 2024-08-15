import { gql } from '@apollo/client'

export const GET_TEMPLATES = gql`
  query GetTemplates($names: [String!]) {
    getTemplates(names: $names) {
      id
      name
      description
      steps {
        id
        name
        position
        appKey
        eventKey
        parameters
      }
    }
  }
`
