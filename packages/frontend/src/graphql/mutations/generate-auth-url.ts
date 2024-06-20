import { graphql } from '../__generated__/gql'

export const GENERATE_AUTH_URL = graphql(`
  mutation generateAuthUrl($input: GenerateAuthUrlInput) {
    generateAuthUrl(input: $input) {
      url
    }
  }
`)
