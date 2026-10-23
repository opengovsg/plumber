/// <reference types="vitest" />

// Configure Vitest (https://vitest.dev/config/)

import { existsSync, globSync, readFileSync } from 'fs'
import { cpus } from 'os'
import path from 'path'

import { config } from 'dotenv'
import { defineConfig, type Plugin } from 'vitest/config'

config({
  // .env-example should be in the same directory as our config.
  path: path.resolve(__dirname, './.env-example'),
})

const UNIT_INCLUDE = 'src/**/*.test.{js,ts}'

function hasModuleMock(absolutePath: string): boolean {
  return /\bvi\.mock\s*\(/.test(readFileSync(absolutePath, 'utf8'))
}

// vi.mock() replaces a module in the worker cache. With isolate: false that
// replacement leaks into later files, so those tests get their own graph.
const isolatedTests = globSync(UNIT_INCLUDE, { cwd: __dirname }).filter(
  (file) => hasModuleMock(path.join(__dirname, file)),
)
const isolatedTestPaths = new Set(
  isolatedTests.map((file) => path.join(__dirname, file)),
)

const watchedServers = new WeakSet<object>()

// Project include/exclude lists are fixed at config load. Restarting reloads
// this config, so a watch-mode edit that adds or removes vi.mock() moves the
// test into the right project.
const reclassifyMockedTestsOnChange: Plugin = {
  name: 'plumber:reclassify-mocked-tests',
  configureVitest({ vitest }) {
    const server = vitest.vite
    if (!vitest.config.watch || watchedServers.has(server)) {
      return
    }
    watchedServers.add(server)

    let restarting = false
    const onTestFileWritten = (file: string): void => {
      if (
        restarting ||
        !existsSync(file) ||
        !vitest.projects.some((project) => project.matchesTestGlob(file))
      ) {
        return
      }
      if (hasModuleMock(file) !== isolatedTestPaths.has(file)) {
        restarting = true
        void server.restart()
      }
    }
    server.watcher.on('add', onTestFileWritten)
    server.watcher.on('change', onTestFileWritten)
  },
}

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
  // Read by @/config/unit-test-mode. Set here so it is live before any test
  // file imports a module that would otherwise connect to Redis or Postgres.
  env: {
    PLUMBER_UNIT_TESTS: '1',
  },
  setupFiles: [
    'dotenv/config',
    path.resolve(__dirname, './test/mock-redis-setup.ts'),
    path.resolve(__dirname, './test/keep-worker-alive-setup.ts'),
  ],
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
        plugins: [reclassifyMockedTestsOnChange],
        resolve: {
          alias: resolveAliases,
        },
        test: {
          ...sharedTest,
          name: 'backend',
          include: [UNIT_INCLUDE],
          exclude: isolatedTests,
          isolate: false,
        },
      },
      {
        plugins: [reclassifyMockedTestsOnChange],
        resolve: {
          alias: resolveAliases,
        },
        test: {
          ...sharedTest,
          name: 'backend-isolated',
          include: isolatedTests,
          isolate: true,
        },
      },
    ],
  },
  resolve: {
    alias: resolveAliases,
  },
})
