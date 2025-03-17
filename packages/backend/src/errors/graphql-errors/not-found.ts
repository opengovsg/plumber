import { GraphQLError } from 'graphql/error'

const NOT_FOUND_ERROR_CODE = 'NOT_FOUND'

export class NotFoundError extends GraphQLError {
  constructor(message: string) {
    super(message, {
      extensions: {
        code: NOT_FOUND_ERROR_CODE,
        message,
        http: {
          status: 404,
        },
      },
    })
  }
}
