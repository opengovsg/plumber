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

const sharedResolve = {
  alias: {
    '@': getPath('./src'),
  },
}

const sharedTest = {
  root: __dirname,
  // Each project runs its own globalSetup. The setup file shares one set of
  // containers between them.
  globalSetup: [getPath('./test/global-setup.ts')],
  setupFiles: [
    'dotenv/config',
    getPath('./test/pg-reset-db-setup.ts'),
    getPath('./test/redis-reset-setup.ts'),
  ],
  pool: 'threads' as const,
  maxWorkers: Math.min(cpus().length, MAX_WORKER_SLOTS),
  sequence: {
    concurrent: false,
  },
  onConsoleLog: (log: string, _type: 'stdout' | 'stderr'): false | void => {
    if (log.startsWith('vite:')) {
      return false
    }
  },
}

// Exported so the root config can register these projects directly. Vitest
// does not expand projects nested inside a project config.
// IMPORTANT: Distinct groupOrder values stop both projects, and other root
// projects, from running in parallel against the shared databases.
export const integrationProjects = [
  {
    resolve: sharedResolve,
    test: {
      ...sharedTest,
      name: 'backend-integration',
      include: [ITEST_INCLUDE],
      exclude: isolatedItests,
      isolate: false,
      env: {
        PLUMBER_ITEST_PROJECT: 'shared',
      },
      sequence: { ...sharedTest.sequence, groupOrder: 1 },
    },
  },
  {
    resolve: sharedResolve,
    test: {
      ...sharedTest,
      name: 'backend-integration-isolated',
      include: isolatedItests,
      isolate: true,
      env: {
        PLUMBER_ITEST_PROJECT: 'isolated',
      },
      sequence: { ...sharedTest.sequence, groupOrder: 2 },
    },
  },
]

export default defineConfig({
  test: {
    maxWorkers: Math.min(cpus().length, MAX_WORKER_SLOTS),
    projects: integrationProjects,
  },
  resolve: sharedResolve,
})
