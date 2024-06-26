import { graphql } from '../__generated__/gql'

export const UPDATE_CONNECTION = graphql(`
  mutation UpdateConnection($input: UpdateConnectionInput) {
    updateConnection(input: $input) {
      id
      key
      verified
      formattedData {
        screenName
      }
    }
  }
`)
