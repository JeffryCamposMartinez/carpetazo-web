import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Pruebas de la web (sin navegador): lógica pura de los flujos críticos y componentes con jsdom. Las pruebas de navegador reales están en e2e/ (Playwright).
export default defineConfig({
  plugins: [react()],
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{js,jsx}'],
    setupFiles: ['src/test/setup.js'],
  },
})
