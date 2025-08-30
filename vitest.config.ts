import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    reporters: ['default', 'html'],
    coverage: {
      enabled: true,
    },
    projects: [
      'packages/frontend/vite.config.ts',
      'packages/backend/vitest.config.ts',
      {
        extends: 'packages/backend/vitest.config.integration.ts',
        test: {
          root: 'packages/backend',
        },
      },
    ],
  },
})
