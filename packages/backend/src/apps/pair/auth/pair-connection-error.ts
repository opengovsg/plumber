import { GraphQLError } from 'graphql/error'

// BadUserInputError responds with HTTP 400, which the frontend's Apollo client
// treats as a network error and drops the message. This keeps the 200 status
// so the connection modal can show the message.
export class PairConnectionError extends GraphQLError {
  constructor(message: string) {
    super(message, { extensions: { code: 'PAIR_CONNECTION_ERROR' } })
  }
}
