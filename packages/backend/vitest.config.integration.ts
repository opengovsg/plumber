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

// vi.mock() replaces a module in the worker cache. With isolate: false that
// replacement leaks into later files, so those tests get their own graph.
function itestsWithModuleMocks(): string[] {
  return globSync(ITEST_INCLUDE, { cwd: __dirname }).filter((file) =>
    /\bvi\.mock\s*\(/.test(readFileSync(join(__dirname, file), 'utf8')),
  )
}

const isolatedItests = itestsWithModuleMocks()

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
