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
