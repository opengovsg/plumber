import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'
import loadVersion from 'vite-plugin-package-version'
import viteTsconfigPaths from 'vite-tsconfig-paths'

import { failOnLeakedNodeBuiltins } from './vite-config-utils'

// Ports are assigned per Superset worktree by .superset/base_port.sh and exported as
// DEV_BACKEND_PORT / DEV_FRONTEND_PORT. Fall back to the classic 3000/3001 for a
// plain, non-Superset `npm run dev`.
const backendPort = process.env.DEV_BACKEND_PORT || '3000'
const frontendPort = Number(process.env.DEV_FRONTEND_PORT) || 3001
const backendTarget = `http://localhost:${backendPort}`

// https://vitejs.dev/config/
export default defineConfig({
  // loadVersion injects package.json version into import.meta.env.PACKAGE_VERSION
  plugins: [react(), viteTsconfigPaths(), loadVersion()],
  build: {
    // disable inline images since we don't allow them in csp
    assetsInlineLimit: 0,
    rollupOptions: {
      onwarn: failOnLeakedNodeBuiltins,
    },
  },
  server: {
    open: `http://localhost:${frontendPort}`,
    port: frontendPort,
    // Fail loudly if the assigned port is taken (Superset worktrees). Stay
    // lenient for plain dev so vite can auto-pick a free port as before.
    strictPort: Boolean(process.env.DEV_FRONTEND_PORT),
    proxy: {
      '/graphql': {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
      },
      '/api': {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
      },
      '/apps': {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
      },
      '/admin/queues': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
