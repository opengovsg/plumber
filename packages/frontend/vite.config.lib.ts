import { resolve } from 'path'

// @ts-check
import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'
import viteTsconfigPaths from 'vite-tsconfig-paths'

import { failOnLeakedNodeBuiltins } from './vite-config-utils.ts'

export default defineConfig({
  plugins: [react(), viteTsconfigPaths()],
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
    rolldownOptions: {
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
      onLog: failOnLeakedNodeBuiltins,
    },
  },
})
