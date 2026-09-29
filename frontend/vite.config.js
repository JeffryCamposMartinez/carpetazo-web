import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
    esbuild: {
    drop: ['console', 'debugger'],
  },
  plugins: [react()],
  server: {
    allowedHosts: true,
    proxy: {
      '/tcgcsv': { target: 'https://tcgcsv.com', changeOrigin: true, headers: { 'User-Agent': 'Carpetazo/1.0 (+https://carpetazo.cl)' }, rewrite: (path) => path.replace(/^\/tcgcsv/, '') },
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  preview: {
    allowedHosts: true,
    proxy: {
      '/tcgcsv': { target: 'https://tcgcsv.com', changeOrigin: true, headers: { 'User-Agent': 'Carpetazo/1.0 (+https://carpetazo.cl)' }, rewrite: (path) => path.replace(/^\/tcgcsv/, '') },
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})

