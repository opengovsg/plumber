import type { IJSONValue } from '@plumber/types'

import { OPERATION_REDACTIONS } from './graphql-operations'
import { REDACTED } from './sensitive-keys'

/**
 * Redacts a logged operation's variables through the callback it declares.
 *
 * IMPORTANT: blanks everything unless the caller names exactly one root field,
 * because an unidentified operation cannot be dispatched.
 */
export function redactGraphqlVariables(
  rootFields: readonly string[] | undefined,
  variables: IJSONValue,
): IJSONValue {
  if (rootFields?.length !== 1) {
    return REDACTED
  }

  const redactVariables = OPERATION_REDACTIONS[rootFields[0]]
  if (!redactVariables) {
    return variables
  }

  try {
    return redactVariables(variables)
  } catch {
    // A half-redacted blob cannot be trusted, so drop all of it.
    return REDACTED
  }
}
