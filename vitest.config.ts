import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    reporters: ['default', 'html'],
    coverage: {
      enabled: true,
      include: ['packages/{backend,frontend}/src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*.itest.{ts,tsx}',
        '**/__tests__/**',
        '**/node_modules/**',
      ],
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
