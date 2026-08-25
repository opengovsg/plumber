/// <reference types="vitest" />

// Configure Vitest (https://vitest.dev/config/)
// This is for tests that require a database connection.

import { globSync, readFileSync } from 'fs'
import { join, resolve } from 'path'

import { config } from 'dotenv'
import { defineConfig } from 'vitest/config'

function getPath(relativePath: string): string {
  return resolve(__dirname, relativePath)
}

config({
  // .env-example should be in the same directory as our config.
  path: getPath('./.env-example'),
})

const ITEST_INCLUDE = 'src/**/*.itest.{js,ts}'

// vi.mock() replaces a module in the worker cache. With isolate: false that
// replacement leaks into later files, so those tests get their own graph.
function itestsWithModuleMocks(): string[] {
  return globSync(ITEST_INCLUDE, { cwd: __dirname }).filter((file) =>
    /\bvi\.mock\s*\(/.test(readFileSync(join(__dirname, file), 'utf8')),
  )
}

const isolatedItests = itestsWithModuleMocks()

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
  setupFiles: ['dotenv/config', getPath('./test/pg-reset-db-setup.ts')],
  pool: 'threads' as const,
  maxWorkers: 1,
  fileParallelism: false,
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
      sequence: { groupOrder: 1 },
    },
  },
  {
    resolve: sharedResolve,
    test: {
      ...sharedTest,
      name: 'backend-integration-isolated',
      include: isolatedItests,
      isolate: true,
      sequence: { groupOrder: 2 },
    },
  },
]

export default defineConfig({
  test: {
    maxWorkers: 1,
    fileParallelism: false,
    projects: integrationProjects,
  },
  resolve: sharedResolve,
})
