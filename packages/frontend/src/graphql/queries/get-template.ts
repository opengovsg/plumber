import { gql } from '@apollo/client'

export const GET_TEMPLATE = gql`
  query GetTemplate($id: String!) {
    getTemplate(id: $id) {
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
