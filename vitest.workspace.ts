import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  'packages/frontend/vite.config.ts',
  'packages/backend/vitest.config.ts',
  // weirdly, this is required to allow multuple vitest config files in the same package
  // this broke when upgrading from 0.32.2
  {
    extends: 'packages/backend/vitest.config.integration.ts',
    test: {
      root: 'packages/backend',
    },
  },
])
