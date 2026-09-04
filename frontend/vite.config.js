import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Allow proxied preview/tunnel hosts (e.g. *.e2b.app) to reach the dev
    // server. Production is served as a static build, so this only affects
    // local and sandboxed development.
    allowedHosts: true,
    proxy: {
      '/api': 'http://localhost:4000'
    }
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
        },
      },
    },
  },
})
