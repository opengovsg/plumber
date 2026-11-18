import { defineConfig } from 'vitest/config'

import { unitProjects as backendUnitProjects } from './packages/backend/vitest.config'
import {
  integrationMaxWorkers,
  integrationProjects,
} from './packages/backend/vitest.config.integration'

export default defineConfig({
  test: {
    reporters: ['default', 'html'],
    maxWorkers: integrationMaxWorkers,
    coverage: {
      enabled: true,
      include: [
        'packages/{backend,backend-archive,backend-analytics,frontend}/src/**/*.{ts,tsx}',
      ],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*.itest.{ts,tsx}',
        '**/__tests__/**',
        '**/node_modules/**',
      ],
    },
    projects: [
      'packages/frontend/vite.config.ts',
      ...backendUnitProjects,
      'packages/backend-archive/vitest.config.ts',
      'packages/backend-analytics/vitest.config.ts',
      ...integrationProjects,
      'packages/backend-analytics/vitest.config.integration.ts',
    ],
  },
})
