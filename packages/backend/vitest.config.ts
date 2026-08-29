/// <reference types="vitest" />

// Configure Vitest (https://vitest.dev/config/)

import { cpus } from 'os'
import path from 'path'

import { config } from 'dotenv'
import { defineConfig } from 'vitest/config'

config({
  // .env-example should be in the same directory as our config.
  path: path.resolve(__dirname, './.env-example'),
})

const UNIT_INCLUDE = 'src/**/*.test.{js,ts}'

const srcAlias = path.resolve(__dirname, './src')
const graphqlShieldAlias = require.resolve('graphql-shield')

const resolveAliases = {
  '@': srcAlias,
  // graphql-shield's ESM build imports `isUndefined` from `util`, which
  // Vite's SSR module resolution fails to resolve. Aliasing straight to
  // the CJS build sidesteps the broken `exports` condition entirely.
  'graphql-shield': graphqlShieldAlias,
}

const sharedTest = {
  setupFiles: ['dotenv/config'],
  pool: 'threads' as const,
  // Vitest 4 can fail the run with EnvironmentTeardownError if a worker
  // shuts down while a console log is still in the reporter RPC channel.
  disableConsoleIntercept: true,
  onConsoleLog: (log: string, _type: 'stdout' | 'stderr'): false | void => {
    if (log.startsWith('vite:')) {
      return false
    }
  },
}

export default defineConfig({
  test: {
    maxWorkers: cpus().length,
    disableConsoleIntercept: true,
    projects: [
      {
        resolve: {
          alias: resolveAliases,
        },
        test: {
          ...sharedTest,
          name: 'backend',
          include: [UNIT_INCLUDE],
          isolate: false,
        },
      },
    ],
  },
  resolve: {
    alias: resolveAliases,
  },
})
