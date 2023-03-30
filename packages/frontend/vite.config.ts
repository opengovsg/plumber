import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import viteTsconfigPaths from 'vite-tsconfig-paths'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), viteTsconfigPaths()],
  server: {
    open: 'http://localhost:3001',
    port: 3001,
    proxy: {
      '/graphql': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        timeout: 10000,
      },
    },
  },
})
