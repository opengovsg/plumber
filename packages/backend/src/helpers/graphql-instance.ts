import { ApolloServer, type ApolloServerPlugin } from '@apollo/server'
import { expressMiddleware } from '@apollo/server/express4'
import { ApolloServerPluginLandingPageDisabled } from '@apollo/server/plugin/disabled'
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default'
import { makeExecutableSchema } from '@graphql-tools/schema'
import { RequestHandler } from 'express'
import { applyMiddleware } from 'graphql-middleware'

import appConfig from '@/config/app'
import { typeDefs } from '@/graphql/__generated__/typeDefs.generated'
import resolvers from '@/graphql/resolvers'
import authentication, { setCurrentUserContext } from '@/helpers/authentication'
import logger from '@/helpers/logger'
import tracer from '@/helpers/tracer'
import type { UnauthenticatedContext } from '@/types/express/context'
import type AuthenticatedContext from '@/types/express/context'

// Adds the logged in user's email (if available) as a span tag to each query.
function ApolloServerPluginUserTracer(): ApolloServerPlugin<AuthenticatedContext> {
  return {
    async requestDidStart() {
      return {
        // Add the tag right before we reply the user.
        // https://www.apollographql.com/docs/apollo-server/integrations/plugins#request-lifecycle-event-flow
        async willSendResponse(requestContext) {
          const span = tracer.scope().active()
          span?.addTags({
            user:
              requestContext.contextValue?.currentUser?.email ??
              'unauthenticated',
          })
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

const server = new ApolloServer<UnauthenticatedContext>({
  schema: schemaWithMiddleware,
  introspection: appConfig.isDev,
  plugins: [
    appConfig.isDev
      ? ApolloServerPluginLandingPageLocalDefault()
      : ApolloServerPluginLandingPageDisabled(),
    ApolloServerPluginUserTracer(),
  ],
  formatError: (error) => {
    logger.error(error)
    let errorMessage = error.message
    if (error.message.includes('Did you mean')) {
      errorMessage = 'Invalid request'
    }
    if (
      error.message.includes("Please either specify a 'content-type' header")
    ) {
      errorMessage = 'Blocked request'
    }
    const newError = {
      message: errorMessage,
      code: error.extensions?.code,
    }
    return newError
  },
})

let graphqlInstance: RequestHandler | undefined

const graphqlRouteHandler: RequestHandler = async (...args) => {
  if (!graphqlInstance) {
    await server.start()
    graphqlInstance = expressMiddleware<UnauthenticatedContext>(server, {
      context: setCurrentUserContext,
    })
  }
  return graphqlInstance(...args)
}

export default graphqlRouteHandler
