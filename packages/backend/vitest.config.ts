/// <reference types="vitest" />

// Configure Vitest (https://vitest.dev/config/)

import { config } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'

config({
  // .env-example should be in the same directory as our config. Note that
  // fileURLToPath has a trailing slash.
  path: `${fileURLToPath(new URL('.', import.meta.url))}.env-example`,
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
