import { graphql } from '@/graphql/__generated__'

export const START_SSO_LOGIN = graphql(`
  mutation StartSsoLogin($input: StartSsoLoginInput) {
    startSsoLogin(input: $input) {
      authorizationUrl
    }
  }
`)
