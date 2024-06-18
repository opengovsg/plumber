import { ApolloServerErrorCode } from '@apollo/server/errors'
import { GraphQLError } from 'graphql/error'

export class BadUserInputError extends GraphQLError {
  constructor(message: string) {
    super(message, {
      extensions: {
        code: ApolloServerErrorCode.BAD_USER_INPUT,
        message,
        http: {
          status: 400,
        },
      },
    })
  }
}
