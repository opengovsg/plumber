import type { ApolloLink } from '@apollo/client'
import { from, HttpLink } from '@apollo/client'
import { onError } from '@apollo/client/link/error'
import { removeTypenameFromVariables } from '@apollo/client/link/remove-typename'
import { CustomGraphQLFormattedError } from '@plumber/types'

import {
  INVALID_TILE_VIEW_KEY,
  INVALID_TILE_VIEW_TOKEN,
  NOT_AUTHORISED,
} from '@/config/errors'

type CreateLinkOptions = {
  uri: string
  token?: string | null
  onError?: (message: string) => void
}

const createHttpLink = (
  options: Pick<CreateLinkOptions, 'uri' | 'token'>,
): ApolloLink => {
  const { uri, token } = options
  const headers = {
    authorization: token || '',
  }
  return new HttpLink({ uri, headers })
}

const createErrorLink = (callback: CreateLinkOptions['onError']): ApolloLink =>
  onError(({ graphQLErrors, networkError, operation }) => {
    const context = operation.getContext()
    const autoSnackbar = context.autoSnackbar ?? true

    // this should catch when user's session has expired or the user is not authorised
    // return early since the status code is enough to identify the error
    if (context.response.status === 401) {
      if (autoSnackbar) {
        callback?.(NOT_AUTHORISED)
      }
      return
    }

    if (graphQLErrors) {
      graphQLErrors.forEach((error: unknown) => {
        const { message, code } = error as CustomGraphQLFormattedError
        // Password-protected tile errors are handled locally by the Tile page
        const noSnackbarErrors = [
          INVALID_TILE_VIEW_KEY,
          INVALID_TILE_VIEW_TOKEN,
        ]

        if (autoSnackbar && !noSnackbarErrors.includes(code)) {
          callback?.(message)
        }

        // oxlint-disable-next-line no-console
        console.log(`[GraphQL error]: Message: ${message}, Code: ${code}`)
      })
    } else if (networkError) {
      if (autoSnackbar) {
        callback?.(networkError.toString())
      }
      // oxlint-disable-next-line no-console
      console.log(`[Network error]: ${networkError}`)
    }
  })

// oxlint-disable-next-line no-empty-function
const noop = () => {}

const createLink = (options: CreateLinkOptions): ApolloLink => {
  const { uri, onError = noop, token } = options

  const httpOptions = { uri, token }

  return from([
    // this removes the __typename from variables before sending to the server,
    // which prevents validation errors especially when duplicating steps
    removeTypenameFromVariables(),
    createErrorLink(onError),
    createHttpLink(httpOptions),
  ])
}

export default createLink
