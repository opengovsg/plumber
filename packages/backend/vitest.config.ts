/// <reference types="vitest" />

// Configure Vitest (https://vitest.dev/config/)

import { config } from 'dotenv'
import path from 'path'
import { defineConfig } from 'vite'

config({
  // .env-example should be in the same directory as our config.
  path: path.resolve(__dirname, './.env-example'),
})

export default defineConfig({
  test: {
    /* for example, use global to avoid globals imports (describe, test, expect): */
    globals: true,
    // load env variables
    setupFiles: ['dotenv/config'],
    includeSource: ['src/**/*.{js,ts}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
