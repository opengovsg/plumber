import { graphql } from '../__generated__/gql'

export const REPLACE_CONNECTION_CREDENTIALS = graphql(`
  mutation ReplaceConnectionCredentials(
    $input: ReplaceConnectionCredentialsInput
  ) {
    replaceConnectionCredentials(input: $input) {
      id
      key
      verified
      formattedData {
        screenName
        env
      }
    }
  }
`)
