import { ApolloError, ServerError } from '@apollo/client'

export function parseGraphqlError(error: ApolloError): {
  statusCode: number | null
  message: string | null
  code: string | null
} {
  if (error.networkError) {
    const serverError = error.networkError as ServerError
    const statusCode = serverError.statusCode
    if (serverError.result) {
      const result = serverError.result as {
        errors: { message: string; code: string }[]
      }
      if (result.errors?.length) {
        const error = result.errors[0]
        return {
          statusCode,
          message: error?.message,
          code: error?.code,
        }
      }
      return {
        statusCode,
        message: serverError.message,
        code: null,
      }
    }
  }
  return {
    statusCode: null,
    message: error.message,
    code: null,
  }
}
