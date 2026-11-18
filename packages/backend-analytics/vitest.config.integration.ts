/// <reference types="vitest" />

import path from 'path'

import { config } from 'dotenv'
import { defineConfig } from 'vitest/config'

config({
  path: path.resolve(__dirname, './.env-example'),
})

// Runs the export queries against a Postgres migrated with backend's migrations.
export default defineConfig({
  test: {
    name: 'backend-archive-integration',
    setupFiles: ['dotenv/config'],
    globalSetup: [path.resolve(__dirname, './test/global-setup.ts')],
    include: ['src/**/*.itest.{js,ts}'],
    // One database, so test files run one at a time.
    fileParallelism: false,
    hookTimeout: 120_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
