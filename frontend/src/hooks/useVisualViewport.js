import { useEffect, useState } from 'react';

// Altura real visible. En el celular, al abrir el teclado la parte visible se achica: el chat usa esta altura para que la barra de
// escribir quede pegada al teclado (como WhatsApp) en vez de quedar tapada.
export default function useVisualViewport(active = true) {
  const [box, setBox] = useState(() => ({ height: typeof window === 'undefined' ? 0 : window.innerHeight, top: 0 }));
  useEffect(() => {
    if (!active) return undefined;
    const viewport = window.visualViewport;
    const update = () => setBox({ height: Math.round(viewport?.height || window.innerHeight), top: Math.round(viewport?.offsetTop || 0) });
    update();
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, [active]);
  return box;
}
