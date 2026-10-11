import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './app/App.jsx'
import ErrorBoundary, { reloadOnceForNewVersion } from './components/ui/ErrorBoundary.jsx'
import { installClientErrorReporting } from './utils/reportError.js'

installClientErrorReporting()

// Las fuentes del texto se piden sin bloquear la primera pintura (media="print") y aquí se activan.
// Antes lo hacía un onload en el HTML, pero la política de seguridad ya no permite código en línea.
document.querySelectorAll('link[data-async-style]').forEach((link) => { link.media = 'all' })

// Si el navegador no puede descargar una parte del sitio (versión nueva publicada), se recarga una vez
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  reloadOnceForNewVersion()
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
