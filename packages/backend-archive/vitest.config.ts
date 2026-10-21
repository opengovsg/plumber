/// <reference types="vitest" />

import { config } from 'dotenv'
import path from 'path'
import { defineConfig } from 'vitest/config'

config({
  path: path.resolve(__dirname, './.env-example'),
})

export default defineConfig({
  test: {
    name: 'backend-archive',
    setupFiles: ['dotenv/config'],
    include: ['src/**/*.test.{js,ts}'],
    onConsoleLog: (log: string, _type: 'stdout' | 'stderr'): false | void => {
      if (log.startsWith('vite:')) {
        return false
      }
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
