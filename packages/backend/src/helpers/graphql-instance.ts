import { ApolloServer } from '@apollo/server'
import { expressMiddleware } from '@apollo/server/express4'
import { makeExecutableSchema } from '@graphql-tools/schema'
import { RequestHandler } from 'express'
import { readFileSync } from 'fs'
import { applyMiddleware } from 'graphql-middleware'
import { join } from 'path'

import appConfig from '@/config/app'
import resolvers from '@/graphql/resolvers'
import authentication, { setCurrentUserContext } from '@/helpers/authentication'
import logger from '@/helpers/logger'
import { UnauthenticatedContext } from '@/types/express/context'

const typeDefs = readFileSync(join(__dirname, '../graphql/schema.graphql'), {
  encoding: 'utf-8',
})

const schema = makeExecutableSchema({ typeDefs, resolvers })

const schemaWithMiddleware = applyMiddleware(
  schema,
  authentication.generate(schema),
)

const server = new ApolloServer<UnauthenticatedContext>({
  schema: schemaWithMiddleware,
  introspection: appConfig.isDev,
  formatError: (error) => {
    logger.error(error.path + ' : ' + error.message)
    return error
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
