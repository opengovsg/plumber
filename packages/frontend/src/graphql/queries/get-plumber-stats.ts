import { gql } from '@apollo/client'

export const GET_PLUMBER_STATS = gql`
  query GetPlumberStats {
    getPlumberStats {
      userCount
      executionCount
    }
  }
`
