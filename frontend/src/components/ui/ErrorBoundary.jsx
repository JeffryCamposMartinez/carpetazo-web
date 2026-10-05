import { Component } from 'react';

// Una pantalla que falla ya no deja la página en blanco: se recupera sola si es una descarga caída
// (p. ej. después de una actualización del sitio) o muestra un aviso con un botón para reintentar.
const RELOAD_KEY = 'carpetazo:chunk-reload';

export const isChunkLoadError = (error) =>
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk|ChunkLoadError/i.test(
    String(error?.message || error || '')
  );

// Recarga una sola vez por minuto para no entrar en bucle si el problema persiste
export const reloadOnceForNewVersion = () => {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < 60000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch (_error) { /* sin almacenamiento: se intenta igual */ }
  window.location.reload();
  return true;
};

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error('Error de pantalla:', error);
    if (isChunkLoadError(error)) reloadOnceForNewVersion();
  }

  componentDidUpdate(prevProps) {
    // Al cambiar de ruta se vuelve a intentar
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-16" role="alert">
        <div className="max-w-sm rounded-3xl bg-white/95 p-6 text-center shadow-xl ring-1 ring-slate-900/5">
          <p className="text-lg font-black text-[#12315f]">Esta pantalla no pudo cargar</p>
          <p className="mt-2 text-sm font-semibold text-slate-600">Puede ser una conexión inestable o una actualización reciente del sitio. Recarga para continuar.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded-full bg-[#facc15] px-6 py-2.5 text-sm font-extrabold text-[#12315f] shadow-md transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-[#12315f]/40"
          >
            Recargar página
          </button>
        </div>
      </div>
    );
  }
}
