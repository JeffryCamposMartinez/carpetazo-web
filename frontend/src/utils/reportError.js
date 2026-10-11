import { API_BASE_URL } from '../services/api';

// Avisa al servidor de un error de la web para que el equipo lo vea en Moderación → Operación.
// Pocos por visita y sin repetir; se ignoran los que no son de Carpetazo (extensiones del navegador) y los de conexión.
const MAX_PER_VISIT = 5;
const sent = new Set();

const IGNORED = /ResizeObserver loop|chrome-extension:|moz-extension:|safari-extension:|Failed to fetch|Load failed|NetworkError|AbortError|dynamically imported module|Importing a module script failed|Loading chunk|Script error/i;

export const reportClientError = (error, source = '') => {
  try {
    const message = String(error?.message || error || '').trim().slice(0, 500);
    if (!message || IGNORED.test(message) || IGNORED.test(String(error?.stack || '')) || sent.size >= MAX_PER_VISIT || sent.has(message)) return;
    sent.add(message);
    fetch(`${API_BASE_URL}/client-errors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({ message: source ? `${source}: ${message}` : message, stack: String(error?.stack || '').slice(0, 3500) || undefined, path: window.location.pathname })
    }).catch(() => {});
  } catch (_error) { /* informar un error nunca debe causar otro */ }
};

export const installClientErrorReporting = () => {
  window.addEventListener('error', (event) => reportClientError(event.error || event.message, 'error'));
  window.addEventListener('unhandledrejection', (event) => reportClientError(event.reason, 'promesa'));
};
