/// <reference types="vitest" />

// Configure Vitest (https://vitest.dev/config/)
// This is for tests that require a database connection.

import { globSync, readFileSync } from 'fs'
import { cpus } from 'os'
import { join, resolve } from 'path'

import { config } from 'dotenv'
import { defineConfig } from 'vitest/config'

import { MAX_WORKER_SLOTS } from './test/helpers/integration-constants'

function getPath(relativePath: string): string {
  return resolve(__dirname, relativePath)
}

config({
  // .env-example should be in the same directory as our config.
  path: getPath('./.env-example'),
})

const ITEST_INCLUDE = 'src/**/*.itest.{js,ts}'
const TEST_HELPERS = 'src/**/__tests__/**/*.ts'

// With isolate: false, these calls leak module or global state into later
// files, so files that use them get their own graph.
// This is a text heuristic. If leaks still slip through, replace it with an
// explicit list of files allowed to share a graph.
const MODULE_STATE_CALL =
  /\bvi\.(mock|doMock|unmock|resetModules|stubGlobal|stubEnv|useFakeTimers|setSystemTime)\s*\(/

function changesModuleState(file: string): boolean {
  return MODULE_STATE_CALL.test(readFileSync(join(__dirname, file), 'utf8'))
}

// IMPORTANT: Isolation is decided per test file. A helper making these calls
// would leak through every test file that imports it.
const helpersChangingModuleState = globSync(TEST_HELPERS, { cwd: __dirname })
  .filter((file) => !/\.(test|itest)\.ts$/.test(file))
  .filter(changesModuleState)
if (helpersChangingModuleState.length > 0) {
  throw new Error(
    `Move these vi calls into the test files: ${helpersChangingModuleState.join(', ')}`,
  )
}

const isolatedItests = globSync(ITEST_INCLUDE, { cwd: __dirname }).filter(
  changesModuleState,
)

const sharedTest = {
  setupFiles: [
    'dotenv/config',
    getPath('./test/pg-reset-db-setup.ts'),
    getPath('./test/redis-reset-setup.ts'),
    getPath('./test/dynamodb-reset-setup.ts'),
  ],
  // Wiping DynamoDB after large tile row tests (e.g. 10k rows) can exceed 10s.
  hookTimeout: 120_000,
  pool: 'threads' as const,
  sequence: {
    concurrent: false,
  },
  onConsoleLog: (log: string, _type: 'stdout' | 'stderr'): false | void => {
    if (log.startsWith('vite:')) {
      return false
    }
  },
}

export default defineConfig({
  test: {
    globalSetup: [getPath('./test/global-setup.ts')],
    maxWorkers: Math.min(cpus().length, MAX_WORKER_SLOTS),
    projects: [
      {
        resolve: {
          alias: {
            '@': getPath('./src'),
          },
        },
        test: {
          ...sharedTest,
          name: 'backend-integration',
          include: [ITEST_INCLUDE],
          exclude: isolatedItests,
          isolate: false,
          env: {
            PLUMBER_ITEST_PROJECT: 'shared',
          },
        },
      },
      {
        resolve: {
          alias: {
            '@': getPath('./src'),
          },
        },
        test: {
          ...sharedTest,
          name: 'backend-integration-isolated',
          include: isolatedItests,
          isolate: true,
          env: {
            PLUMBER_ITEST_PROJECT: 'isolated',
          },
        },
      },
    ],
  },
  resolve: {
    alias: {
      '@': getPath('./src'),
    },
  },
})
