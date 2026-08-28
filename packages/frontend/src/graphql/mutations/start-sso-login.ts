import { graphql } from '@/graphql/__generated__'

export const START_SSO_LOGIN = graphql(`
  mutation StartSsoLogin {
    startSsoLogin {
      authorizationUrl
    }
  }
`)
