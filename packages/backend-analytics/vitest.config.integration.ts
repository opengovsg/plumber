/// <reference types="vitest" />

import path from 'path'

import { defineConfig } from 'vitest/config'

// Runs the export queries against a Postgres migrated with backend's migrations.
export default defineConfig({
  test: {
    name: 'backend-analytics-integration',
    globalSetup: [path.resolve(__dirname, './test/global-setup.ts')],
    include: ['src/**/*.itest.{js,ts}'],
    // One database, so test files run one at a time.
    fileParallelism: false,
    hookTimeout: 120_000,
  },
})
