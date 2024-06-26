import { graphql } from '../__generated__/gql'

export const REGISTER_CONNECTION = graphql(`
  mutation RegisterConnection($input: RegisterConnectionInput) {
    registerConnection(input: $input)
  }
`)
