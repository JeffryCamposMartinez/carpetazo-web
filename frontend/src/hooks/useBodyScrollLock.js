import { useEffect } from 'react';

// Bloquea el scroll de la página detrás de un panel o una hoja. En Safari de iPhone «overflow: hidden» en el body no basta:
// la página se sigue moviendo al arrastrar. Se fija el body en su posición actual y al cerrar se vuelve al mismo punto.
// Varios paneles pueden pedir el bloqueo a la vez (p. ej. el chat y una hoja encima): se cuenta cuántos hay y solo el primero lo aplica
// y el último lo quita, sin importar en qué orden se cierren. Así la página nunca queda trabada.
let locks = 0;
let saved = null;

const apply = () => {
  const { body, documentElement } = document;
  const scrollY = window.scrollY;
  saved = {
    scrollY,
    style: { position: body.style.position, top: body.style.top, left: body.style.left, right: body.style.right, width: body.style.width, overflow: body.style.overflow },
    overscroll: documentElement.style.overscrollBehavior,
  };
  Object.assign(body.style, { position: 'fixed', top: `-${scrollY}px`, left: '0', right: '0', width: '100%', overflow: 'hidden' });
  documentElement.style.overscrollBehavior = 'none';
};

const release = () => {
  if (!saved) return;
  const { body, documentElement } = document;
  Object.assign(body.style, saved.style);
  documentElement.style.overscrollBehavior = saved.overscroll;
  const { scrollY } = saved;
  saved = null;
  window.scrollTo({ top: scrollY, behavior: 'instant' }); // sin animación: la página queda donde estaba
};

export default function useBodyScrollLock(active = true) {
  useEffect(() => {
    if (!active) return undefined;
    if (locks === 0) apply();
    locks += 1;
    return () => {
      locks = Math.max(0, locks - 1);
      if (locks === 0) release();
    };
  }, [active]);
}
