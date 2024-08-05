// @ts-check

import react from '@vitejs/plugin-react'
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
        'react',
        'react/jsx-runtime',
        'react-dom',
        'react-dom/client',
        'react-router-dom',
      ],
    },
  },
})
