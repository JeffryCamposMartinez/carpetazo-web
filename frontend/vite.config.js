import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'https://cheerful-patience-production-0bbd.up.railway.app',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  preview: {
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'https://cheerful-patience-production-0bbd.up.railway.app',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
