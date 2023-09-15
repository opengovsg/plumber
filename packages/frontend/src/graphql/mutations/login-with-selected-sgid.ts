import { gql } from '@apollo/client'

export const LOGIN_WITH_SELECTED_SGID = gql`
  mutation LoginWithSelectedSgid($input: LoginWithSelectedSgidInput!) {
    loginWithSelectedSgid(input: $input) {
      success
    }
  }
`
