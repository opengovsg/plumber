import { graphql } from '@/graphql/__generated__'

export const LOGIN_WITH_SSO = graphql(`
  mutation LoginWithSso($input: SsoLoginInput!) {
    loginWithSso(input: $input)
  }
`)
