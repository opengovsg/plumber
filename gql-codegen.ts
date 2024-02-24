import { defineConfig } from '@eddeee888/gcg-typescript-resolver-files'
import type { CodegenConfig } from '@graphql-codegen/cli'

const config: CodegenConfig = {
  overwrite: true,
  schema: 'packages/backend/src/graphql/**/schema.graphql',
  documents: [
    'packages/frontend/src/graphql/**/*.ts',
    'packages/frontend/src/components/**/*.tsx',
  ],
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
        //
        // NOTE: immutableTypes is not enabled here as the libraries we use
        // (e.g. objectionjs) have not marked their function params as
        // readonly; enabling this will cause too much friction for not that
        // much gain.
        defaultScalarType: 'unknown',
        strictScalars: true,
        useTypeImports: true,

        // In addition to normal functions, resolvers can also be objects with a
        //  `resolve` function. Due to this, the generated types for resolvers
        // are not callable without further type refinement.
        //
        // This refinement adds a lot of boilerplate in our unit tests; since we
        // exclusively use resolver functions, we'll disable resolver objects to
        // omit the need for this boilerplate.
        makeResolverTypeCallable: true,

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
      presetConfig: {
        // Prevent fragment masking from colliding with React hooks
        // https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#the-usefragment-helper
        fragmentMasking: {
          unmaskFunctionName: 'getFragmentData',
        },
      },
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
