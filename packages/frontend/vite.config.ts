import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'
import loadVersion from 'vite-plugin-package-version'
import viteTsconfigPaths from 'vite-tsconfig-paths'

// https://vitejs.dev/config/
export default defineConfig({
  // loadVersion injects package.json version into import.meta.env.PACKAGE_VERSION
  plugins: [react(), viteTsconfigPaths(), loadVersion()],
  build: {
    // disable inline images since we don't allow them in csp
    assetsInlineLimit: 0,
    rollupOptions: {
      // Guardrail for the @emailens/engine tech-debt: the engine declares
      // `engines.node: ">=18"` but the slice we use (transformForClient) is
      // browser-safe. If a future version of @emailens/engine — or any other
      // dep — starts importing a node-only module (fs, path, crypto, etc.),
      // Vite externalizes it and emits a warning. We promote that warning to
      // a hard error so CI catches the regression instead of silently
      // shipping a broken bundle.
      onwarn(warning, defaultHandler) {
        const msg = warning.message ?? ''
        if (
          msg.includes('has been externalized for browser compatibility') ||
          warning.code === 'MISSING_NODE_BUILTINS'
        ) {
          throw new Error(
            `[vite-guardrail] A node-only import leaked into the frontend bundle. ` +
              `This guardrail exists to catch @emailens/engine (and similar libraries) ` +
              `pulling in backend-only modules. Original warning: ${msg}`,
          )
        }
        defaultHandler(warning)
      },
    },
  },
  server: {
    open: 'http://localhost:3001',
    port: 3001,
    proxy: {
      '/graphql': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      '/apps': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
