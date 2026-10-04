import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Fuente de íconos: la completa pesa ~1 MB; Google Fonts permite pedir solo los íconos usados (icon_names).
// La lista se arma sola en cada build (y en cada recarga en desarrollo) con los textos del código que parecen nombres de ícono;
// los que no son íconos Google los ignora. Así un ícono nuevo nunca queda sin dibujar.
const materialIconNames = () => {
  const names = new Set()
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(file)
      else if (/\.(jsx?|tsx?)$/.test(entry.name)) {
        const source = fs.readFileSync(file, 'utf8')
        for (const match of source.matchAll(/['"`]([a-z][a-z0-9_]{1,40})['"`]/g)) names.add(match[1])
        for (const match of source.matchAll(/material-symbols[^>]*>\s*([a-z][a-z0-9_]*)\s*</g)) names.add(match[1])
      }
    }
  }
  walk(path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'src'))
  return [...names].sort().join(',')
}
const materialIconsSubset = () => ({
  name: 'material-icons-subset',
  transformIndexHtml: (html) => html.replace('__MATERIAL_ICON_NAMES__', materialIconNames())
})

// https://vite.dev/config/
export default defineConfig({
    esbuild: {
    drop: ['console', 'debugger'],
  },
  plugins: [react(), materialIconsSubset()],
  server: {
    allowedHosts: true,
    proxy: {
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
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})

