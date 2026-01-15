import { GraphQLError } from 'graphql/error'

export class UnauthorisedError extends GraphQLError {
  constructor() {
    super('Not Authorised!', {
      extensions: {
        code: 'Not Authorised!',
        message: 'Not Authorised!',
        http: {
          status: 401,
        },
      },
    })
  }
}
