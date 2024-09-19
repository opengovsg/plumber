import { gql } from '@apollo/client'

export const GET_TEMPLATES = gql`
  query GetTemplates($isEmptyFlowsTemplates: Boolean) {
    getTemplates(isEmptyFlowsTemplates: $isEmptyFlowsTemplates) {
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
