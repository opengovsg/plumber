import { graphql } from 'graphql/__generated__'

export const DELETE_CONNECTION = graphql(`
  mutation DeleteConnection($input: DeleteConnectionInput) {
    deleteConnection(input: $input)
  }
`)
