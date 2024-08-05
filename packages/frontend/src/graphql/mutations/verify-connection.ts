import { graphql } from '@/graphql/__generated__'

export const VERIFY_CONNECTION = graphql(`
  mutation VerifyConnection($input: VerifyConnectionInput) {
    verifyConnection(input: $input) {
      id
      key
      verified
      formattedData {
        screenName
      }
      createdAt
      app {
        key
      }
    }
  }
`)
