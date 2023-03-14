import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader'
import { loadSchemaSync } from '@graphql-tools/load'
import { addResolversToSchema } from '@graphql-tools/schema'
import { graphqlHTTP } from 'express-graphql'
import { applyMiddleware } from 'graphql-middleware'
import { join } from 'path'

import HttpError from '../errors/http'
import resolvers from '../graphql/resolvers'
import authentication from '../helpers/authentication'
import logger from '../helpers/logger'

const schema = loadSchemaSync(join(__dirname, '../graphql/schema.graphql'), {
  loaders: [new GraphQLFileLoader()],
})

const schemaWithResolvers = addResolversToSchema({
  schema,
  resolvers,
})

const graphQLInstance = graphqlHTTP({
  schema: applyMiddleware(schemaWithResolvers, authentication),
  graphiql: true,
  customFormatErrorFn: (error) => {
    logger.error(error.path + ' : ' + error.message + '\n' + error.stack)

    if (error.originalError instanceof HttpError) {
      delete (error.originalError as HttpError).response
    }

    return error
  },
})

export default graphQLInstance
