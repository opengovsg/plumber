import { GraphQLError } from 'graphql/error'

const RATE_LIMITED_ERROR_CODE = 'RATE_LIMITED'

export class RateLimitedError extends GraphQLError {
  constructor(message: string) {
    super(message, {
      extensions: {
        code: RATE_LIMITED_ERROR_CODE,
        message,
        http: {
          status: 429,
        },
      },
    })
  }
}
