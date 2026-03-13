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
      auth
    }
  }
`
