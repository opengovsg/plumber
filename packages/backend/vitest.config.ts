/// <reference types="vitest" />

// Configure Vitest (https://vitest.dev/config/)

import path from 'path'

import { config } from 'dotenv'
import { defineConfig } from 'vitest/config'

config({
  // .env-example should be in the same directory as our config.
  path: path.resolve(__dirname, './.env-example'),
})

export default defineConfig({
  test: {
    name: 'backend',
    // load env variables
    setupFiles: ['dotenv/config'],
    include: ['src/**/*.test.{js,ts}'],
    // Vitest 4 can fail the run with EnvironmentTeardownError if a worker
    // shuts down while a console log is still in the reporter RPC channel.
    disableConsoleIntercept: true,
    onConsoleLog: (log: string, _type: 'stdout' | 'stderr'): false | void => {
      if (log.startsWith('vite:')) {
        return false
      }
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // graphql-shield's ESM build imports `isUndefined` from `util`, which
      // Vite's SSR module resolution fails to resolve. Aliasing straight to
      // the CJS build sidesteps the broken `exports` condition entirely.
      'graphql-shield': require.resolve('graphql-shield'),
    },
  },
})
