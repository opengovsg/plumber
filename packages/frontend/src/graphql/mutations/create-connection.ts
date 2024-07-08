import { graphql } from '../__generated__/gql'

export const CREATE_CONNECTION = graphql(`
  mutation CreateConnection($input: CreateConnectionInput) {
    createConnection(input: $input) {
      id
      key
      verified
      formattedData {
        screenName
      }
    }
  }
`)
