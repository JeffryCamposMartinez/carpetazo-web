import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary, { reloadOnceForNewVersion } from './components/ErrorBoundary.jsx'

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
