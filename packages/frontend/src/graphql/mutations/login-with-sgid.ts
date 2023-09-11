import { gql } from '@apollo/client'

export const LOGIN_WITH_SGID = gql`
  mutation LoginWithSgid($input: LoginWithSgidInput!) {
    loginWithSgid(input: $input) {
      publicOfficerEmployments {
        # Temporary only; next PRs will fetch more data to render list if user
        # has multiple work emails.
        __typename
      }
    }
  }
`
