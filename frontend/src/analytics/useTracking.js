import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { initTracking, trackPageView } from './tracker';

// Se monta una sola vez dentro del enrutador: arranca el rastreador y registra cada cambio de ruta
export default function useTracking() {
  const location = useLocation();
  useEffect(() => { initTracking(); }, []);
  useEffect(() => {
    // El título se actualiza justo después de cambiar de ruta: se lee un instante más tarde
    const timer = window.setTimeout(() => trackPageView(location.pathname, document.title), 50);
    return () => window.clearTimeout(timer);
  }, [location.pathname]);
}
