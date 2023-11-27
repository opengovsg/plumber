import { gql } from '@apollo/client'

export const REGISTER_CONNECTION = gql`
  mutation RegisterConnection($input: RegisterConnectionInput) {
    registerConnection(input: $input)
  }
`
