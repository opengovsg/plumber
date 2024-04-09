import { defineConfig } from '@eddeee888/gcg-typescript-resolver-files'
import type { CodegenConfig } from '@graphql-codegen/cli'

const config: CodegenConfig = {
  overwrite: true,
  schema: 'packages/backend/src/graphql/**/schema.graphql',
  documents: ['packages/frontend/src/graphql/**/*.ts'],
  generates: {
    //
    // Backend
    //
    // Config Docs:
    // https://github.com/eddeee888/graphql-code-generator-plugins/tree/master/packages/typescript-resolver-files#config
    //
    'packages/backend/src/graphql/__generated__/': defineConfig({
      // We already have an existing resolver file structure, so disable the
      // built-in resolver codegen
      resolverGeneration: 'disabled',

      tsConfigFilePath: 'packages/backend/tsconfig.json',

      // Configures which files to inspect to get GraphQL type -> TypeScript
      // type mappings.
      mappersFileExtension: '.gql-to-typescript.ts',
      mappersSuffix: 'GraphQLType',

      // Disable scalar validation for now - too dangerous due to bad schema
      // typing.
      // FIXME (ogp-weeloong): fix schema problems and enable this!
      scalarsModule: false,

      scalarsOverrides: {
        // Use type-fest's JSON types in generated code, as they're nice.
        JSONObject: {
          type: {
            input: 'type-fest#JsonObject',
            output: 'type-fest#JsonObject',
          },
        },
        JSON: {
          type: {
            input: 'type-fest#JsonValue',
            output: 'type-fest#JsonValue',
          },
        },
      },

      typesPluginsConfig: {
        // Add some stricter type checking. See
        // https://the-guild.dev/graphql/codegen/plugins/typescript/typescript-resolvers
        // for more info.
        defaultScalarType: 'unknown',
        strictScalars: true,
        useTypeImports: true,
        immutableTypes: true,

        // In addition to normal functions, resolvers (i.e. code that implements
        // a GraphQL mutation / query / field) can also be objects with a
        // `resolve` function. Due to this, the generated types for resolvers
        // are not callable by default.
        //
        // However, we only ever use resolver functions, and we directly call
        // our resolvers in unit tests (e.g. `await getExecutions(...)`). This
        // setting tells graphql-codegen to always type resolvers as functions so that
        // we can continue calling our resolvers in unit tests.
        makeResolverTypeCallable: true,

        // By default, graphql-codegen allows resolvers (for queries / mutations
        // / fields) to return Promises (e.g. in getExecutions(...) => Promise<T>,
        // T can technically be Promise itself).
        //
        // This complicates our unit tests because we have to add extra code to
        // deal with possibility of nested Promises. Since we never actually
        // return nested Promises, to avoid the extra code, we configure
        // graphql-codegen to avoid typing nested Promises.
        resolverTypeWrapperSignature: 'T',

        // Make resolvers' 4th `info` argument optional. This reduces
        // boilerplate in our unit tests.
        // See https://www.apollographql.com/docs/apollo-server/data/resolvers/#resolver-arguments
        optionalInfoArgument: true,

        // Set up the default context for our resolvers / queries / mutations.
        contextType: '@/graphql/schema.context#AuthenticatedGraphQLContext',

        // Some resolvers / queries / mutations need different contexts
        fieldContextTypes: [
          'Query.getCurrentUser#@/graphql/schema.context#UnauthenticatedGraphQLContext',
        ],
      },
    }),
    //
    // Frontend
    //
    // Config Docs:
    // https://the-guild.dev/graphql/codegen/docs/guides/react-vue#config-api
    //
    'packages/frontend/src/graphql/__generated__/': {
      preset: 'client',
      config: {
        // Add some stricter type checking.
        defaultScalarType: 'unknown',
        strictScalars: true,
        useTypeImports: true,
        immutableTypes: true,

        scalars: {
          // Use type-fest's JSON types in generated code, as they're nice.
          JSONObject: 'type-fest#JsonObject',
          JSON: 'type-fest#JsonValue',
        },
      },
    },
  },
}

export default config
