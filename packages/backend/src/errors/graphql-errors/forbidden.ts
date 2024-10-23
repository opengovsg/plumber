import { GraphQLError } from 'graphql/error'

const FORBIDDEN_ERROR_CODE = 'FORBIDDEN'

export class ForbiddenError extends GraphQLError {
  constructor(message: string) {
    super(message, {
      extensions: {
        code: FORBIDDEN_ERROR_CODE,
        message,
        http: {
          status: 403,
        },
      },
    })
  }
}
