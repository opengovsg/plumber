import { graphql } from 'graphql/__generated__'

export const LOGIN_WITH_SELECTED_SGID = graphql(`
  mutation LoginWithSelectedSgid($input: LoginWithSelectedSgidInput!) {
    loginWithSelectedSgid(input: $input) {
      success
    }
  }
`)
