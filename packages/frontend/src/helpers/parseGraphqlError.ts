import { ApolloError, ServerError } from '@apollo/client'
import { CustomGraphQLFormattedError } from '@plumber/types'

export function parseGraphqlError(
  error: ApolloError,
): CustomGraphQLFormattedError {
  // Handle GraphQL errors (HTTP 200 responses with errors in the body)
  if (error.graphQLErrors?.length) {
    const graphqlError = error.graphQLErrors[0] as CustomGraphQLFormattedError
    return graphqlError
  }

  // Handle network errors (non-200 HTTP responses, e.g. 403 from ForbiddenError)
  if (error.networkError) {
    const serverError = error.networkError as ServerError
    if (serverError.result) {
      const result = serverError.result as {
        errors: CustomGraphQLFormattedError[]
      }
      if (result.errors?.length) {
        return result.errors[0]
      }
    }
  }

  return {
    message: error.message,
    code: '',
  }
}
