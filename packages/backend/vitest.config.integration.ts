/// <reference types="vitest" />

// Configure Vitest (https://vitest.dev/config/)
// This is for tests that require a database connection.

import { config } from 'dotenv'
import { resolve } from 'path'
import { defineConfig } from 'vite'

function getPath(relativePath: string): string {
  return resolve(__dirname, relativePath)
}

config({
  // .env-example should be in the same directory as our config.
  path: getPath('./.env-example'),
})

export default defineConfig({
  test: {
    name: 'backend-integration',
    // load env variables
    setupFiles: ['dotenv/config', getPath('./test/pg-reset-db-setup.ts')],
    globalSetup: [
      getPath('./test/pg-global-setup.ts'),
      getPath('./test/redis-global-setup.ts'),
    ],
    include: ['src/**/*.itest.{js,ts}'],
    threads: false,
  },
  resolve: {
    alias: {
      '@': getPath('./src'),
    },
  },
})
