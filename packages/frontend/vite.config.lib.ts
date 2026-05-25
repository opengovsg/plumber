// @ts-check
import react from '@vitejs/plugin-react-swc'
import { resolve } from 'path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import viteTsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [
    react(),
    viteTsconfigPaths(),
    dts({
      insertTypesEntry: true,
    }),
  ],
  build: {
    // disable inline images since we don't allow them in csp
    assetsInlineLimit: 0,
    outDir: 'dist/lib',
    copyPublicDir: false,

    lib: {
      name: 'frontend',
      entry: {
        'exports/index': resolve(__dirname, 'src/exports/index.ts'),
        'exports/components': resolve(__dirname, 'src/exports/components.ts'),
        'exports/contexts': resolve(__dirname, 'src/exports/contexts.ts'),
        'exports/graphql': resolve(__dirname, 'src/exports/graphql.ts'),
        'exports/pages': resolve(__dirname, 'src/exports/pages.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        '@apollo/client',
        '@chakra-ui/react',
        'graphql',
        'launchdarkly-js-client-sdk',
        'launchdarkly-react-client-sdk',
        'react',
        'react/jsx-runtime',
        'react-dom',
        'react-dom/client',
        'react-router-dom',
        'zod',
      ],
      // Guardrail for the @emailens/engine tech-debt: the engine declares
      // `engines.node: ">=18"` but the slice we use (transformForClient) is
      // browser-safe. If a future version of @emailens/engine — or any other
      // dep — starts importing a node-only module (fs, path, crypto, etc.),
      // Vite externalizes it and emits a warning. We promote that warning to
      // a hard error so CI catches the regression instead of silently
      // shipping a broken bundle.
      onwarn(warning, defaultHandler) {
        const msg = warning.message ?? ''
        if (
          msg.includes('has been externalized for browser compatibility') ||
          warning.code === 'MISSING_NODE_BUILTINS'
        ) {
          throw new Error(
            `[vite-guardrail] A node-only import leaked into the frontend bundle. ` +
              `This guardrail exists to catch @emailens/engine (and similar libraries) ` +
              `pulling in backend-only modules. Original warning: ${msg}`,
          )
        }
        defaultHandler(warning)
      },
    },
  },
})
