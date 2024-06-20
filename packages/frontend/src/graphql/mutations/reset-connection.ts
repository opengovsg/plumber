import { graphql } from '../__generated__/gql'

export const RESET_CONNECTION = graphql(`
  mutation ResetConnection($input: ResetConnectionInput) {
    resetConnection(input: $input) {
      id
    }
  }
`)
