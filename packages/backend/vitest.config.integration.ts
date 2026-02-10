/// <reference types="vitest" />

// Configure Vitest (https://vitest.dev/config/)
// This is for tests that require a database connection.

import { config } from 'dotenv'
import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

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
    // load env variables, then override POSTGRES_DATABASE per fork worker
    setupFiles: [
      'dotenv/config',
      getPath('./test/worker-db-setup.ts'),
      getPath('./test/pg-reset-db-setup.ts'),
      getPath('./test/ddb-reset-db-setup.ts'),
    ],
    globalSetup: [
      getPath('./test/pg-global-setup.ts'),
      getPath('./test/tiles-pg-global-setup.ts'),
      getPath('./test/ddb-global-setup.ts'),
      getPath('./test/redis-global-setup.ts'),
    ],
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: parseInt(process.env.VITEST_MAX_FORKS || '4'),
        minForks: 1,
      },
    },
    include: ['src/**/*.itest.{js,ts}'],
    onConsoleLog: (log: string, _type: 'stdout' | 'stderr'): false | void => {
      if (log.startsWith('vite:')) {
        return false
      }
    },
  },
  resolve: {
    alias: {
      '@': getPath('./src'),
    },
  },
})
