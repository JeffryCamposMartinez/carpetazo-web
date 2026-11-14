import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Avisa antes de salir de la página mientras hay avance sin guardar: enlaces de la web, botón «atrás» y cerrar o recargar la pestaña.
// `ask(path)` pide confirmación para una navegación hecha por código. `pending` = destino a la espera de respuesta ('back' si fue «atrás»).
export default function useLeaveGuard(active) {
  const navigate = useNavigate();
  const [pending, setPending] = useState(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    if (!active) return undefined;
    const onUnload = (event) => { event.preventDefault(); event.returnValue = ''; };
    const onClick = (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target.closest?.('a[href]');
      if (!link || (link.target && link.target !== '_self') || link.hasAttribute('download')) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname + url.search === window.location.pathname + window.location.search) return;
      event.preventDefault();
      event.stopPropagation();
      setPending(url.pathname + url.search + url.hash);
    };
    // Botón «atrás»: se deja una entrada de más en el historial para poder detenerlo
    window.history.pushState(window.history.state, '', window.location.href);
    const onPop = () => { if (activeRef.current) { window.history.pushState(window.history.state, '', window.location.href); setPending('back'); } };
    window.addEventListener('beforeunload', onUnload);
    window.addEventListener('popstate', onPop);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      window.removeEventListener('popstate', onPop);
      document.removeEventListener('click', onClick, true);
    };
  }, [active]);

  const ask = useCallback((path) => { if (activeRef.current) setPending(path); else navigate(path); }, [navigate]);
  const cancel = useCallback(() => setPending(null), []);
  const confirm = useCallback(() => {
    const target = pending;
    setPending(null);
    activeRef.current = false; // ya no se detiene la salida
    if (target === 'back') window.history.go(-2); // la entrada extra y la página anterior
    else if (target) navigate(target);
  }, [pending, navigate]);
  return { pending, ask, cancel, confirm };
}
