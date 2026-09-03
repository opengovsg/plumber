import type { ApolloServerPlugin } from '@apollo/server'
import type { Request } from 'express'
import { type FieldNode, Kind } from 'graphql/language'

import type { UnauthenticatedContext } from '@/types/express/context'

// A symbol cannot collide with express or another middleware, and it stays out
// of the Object.entries walks that the log formatters run.
const ROOT_FIELDS = Symbol('plumberGraphqlRootFields')

type StampedRequest = Request & { [ROOT_FIELDS]?: readonly string[] }

export function readGraphqlRootFields(
  req: Request,
): readonly string[] | undefined {
  return (req as StampedRequest)[ROOT_FIELDS]
}

/**
 * Names the operation's root fields so the access log can redact its variables.
 *
 * IMPORTANT: never throws. Apollo turns a didResolveOperation throw into an
 * error response, so a logging bug here would fail the request.
 */
export function StampGraphqlRootFields(): ApolloServerPlugin<UnauthenticatedContext> {
  return {
    async requestDidStart() {
      return {
        async didResolveOperation(requestContext) {
          try {
            const { operation } = requestContext
            if (!operation) {
              return
            }

            const req = requestContext.contextValue.req as StampedRequest
            req[ROOT_FIELDS] = operation.selectionSet.selections
              .filter(
                (selection): selection is FieldNode =>
                  selection.kind === Kind.FIELD,
              )
              .map((selection) => selection.name.value)
          } catch {
            // No stamp makes the logger blank the whole variables blob.
          }
        },
      }
    },
  }
}
