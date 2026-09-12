import { CustomGraphQLFormattedError } from '@plumber/types'

import { ApolloServer, type ApolloServerPlugin } from '@apollo/server'
import { unwrapResolverError } from '@apollo/server/errors'
import { ApolloServerPluginLandingPageDisabled } from '@apollo/server/plugin/disabled'
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default'
import { expressMiddleware } from '@as-integrations/express4'
import { makeExecutableSchema } from '@graphql-tools/schema'
import { RequestHandler } from 'express'
import { Kind, OperationDefinitionNode } from 'graphql/language'
import { applyMiddleware } from 'graphql-middleware'
import { DBError } from 'objection'

import appConfig from '@/config/app'
import { BadUserInputError, UnauthorisedError } from '@/errors/graphql-errors'
import InvalidTileViewKeyError from '@/errors/invalid-tile-view-key'
import InvalidTileViewTokenError from '@/errors/invalid-tile-view-password'
import { typeDefs } from '@/graphql/__generated__/typeDefs.generated'
import resolvers from '@/graphql/resolvers'
import authentication, { setCurrentUserContext } from '@/helpers/authentication'
import logger from '@/helpers/logger'
import {
  createRequestContext,
  getRequestStats,
  requestContext,
} from '@/helpers/request-context'
import tracer from '@/helpers/tracer'
import type { UnauthenticatedContext } from '@/types/express/context'
import type AuthenticatedContext from '@/types/express/context'

// Adds the logged in user's email (if available) as a span tag to each query.
function ApolloServerPluginUserTracer(): ApolloServerPlugin<AuthenticatedContext> {
  return {
    async requestDidStart(requestContext) {
      // Add the tag right before we reply the user.
      // https://www.apollographql.com/docs/apollo-server/integrations/plugins#request-lifecycle-event-flow
      const isAdminOperation = requestContext.contextValue?.isAdminOperation
        ? 'true'
        : 'false'
      tracer.scope().active()?.addTags({
        isAdminOperation,
      })

      const currentUser = requestContext.contextValue?.currentUser
      if (currentUser) {
        tracer.setUser({
          id: currentUser.id,
          email: currentUser.email,

          // For convenience
          isAdminOperation,
        })
      }
    },
  }
}

function PreventBatching(): ApolloServerPlugin {
  return {
    async requestDidStart() {
      return {
        async didResolveOperation(requestContext) {
          const { document } = requestContext
          // There should only be one operation definition per document
          const queryDefinition = document.definitions.find(
            (definition) => definition.kind === Kind.OPERATION_DEFINITION,
          ) as OperationDefinitionNode | undefined

          // Check if there are multiple selections (root fields) in the query
          if (queryDefinition?.selectionSet.selections.length > 1) {
            throw new BadUserInputError(
              'Multiple root fields in a single operation are not allowed.',
            )
          }
        },
      }
    },
  }
}

const schema = makeExecutableSchema({ typeDefs, resolvers })

const schemaWithMiddleware = applyMiddleware(
  schema,
  authentication.generate(schema),
)

export const server = new ApolloServer<UnauthenticatedContext>({
  schema: schemaWithMiddleware,
  introspection: appConfig.isDev,
  plugins: [
    appConfig.isDev
      ? ApolloServerPluginLandingPageLocalDefault()
      : ApolloServerPluginLandingPageDisabled(),
    ApolloServerPluginUserTracer(),
    PreventBatching(),
  ],
  // We don't want to allow batching within a single HTTP request, this defaults to false
  allowBatchedHttpRequests: false,
  formatError: (formattedError, error): CustomGraphQLFormattedError => {
    logger.error(formattedError)

    const unwrappedError = unwrapResolverError(error)
    // NOTE: objection throws all error with DBError class
    // so we handle them here
    if (unwrappedError instanceof DBError) {
      return { message: 'Internal server error', code: 'INTERNAL_SERVER_ERROR' }
    }

    if (unwrappedError instanceof UnauthorisedError) {
      return { message: 'Not Authorised!', code: 'NOT_AUTHORISED' }
    }

    if (unwrappedError instanceof InvalidTileViewKeyError) {
      return {
        message: unwrappedError.message,
        code: unwrappedError.code,
      }
    }
    if (unwrappedError instanceof InvalidTileViewTokenError) {
      return {
        message: unwrappedError.message,
        code: unwrappedError.code,
        data: {
          tableName: unwrappedError.tableName,
        },
      }
    }

    // NOTE: handles INTERNAL_SERVER_ERROR
    // logs the error on the server and return a generic message to the frontend
    // to prevent leaking internal server error details to the frontend such as the
    // exact SQL queries.
    if (formattedError.extensions?.code === 'INTERNAL_SERVER_ERROR') {
      // Return a generic message to the frontend
      let message = 'An error has occurred'
      if (formattedError?.message) {
        message += ': ' + formattedError?.message
      }
      return { message, code: 'INTERNAL_SERVER_ERROR' }
    }

    let errorMessage = formattedError.message
    if (formattedError.message.includes('Did you mean')) {
      errorMessage = 'Invalid request'
    }
    if (
      formattedError.message.includes(
        "Please either specify a 'content-type' header",
      )
    ) {
      errorMessage = 'Blocked request'
    }
    const newError = {
      message: errorMessage,
      code: formattedError.extensions?.code as string,
    }
    return newError
  },
})

let graphqlInstance: RequestHandler | undefined

const graphqlRouteHandler: RequestHandler = async (req, res, next) => {
  if (!graphqlInstance) {
    await server.start()
    graphqlInstance = expressMiddleware<UnauthenticatedContext>(server, {
      context: setCurrentUserContext,
    })
  }

  const operationName = req.body?.operationName || 'unknown'
  const startTime = Date.now()

  requestContext.run(createRequestContext(operationName), () => {
    res.on('finish', () => {
      const stats = getRequestStats()
      const totalMs = Date.now() - startTime
      logger.info(
        `[GraphQL][${operationName}] ${totalMs}ms | ${stats.queryCount} queries (${stats.totalQueryMs}ms)`,
      )
    })
    graphqlInstance(req, res, next)
  })
}

export default graphqlRouteHandler
