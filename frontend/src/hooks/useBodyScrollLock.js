import { useEffect } from 'react';

// Bloquea el scroll de la página detrás de un panel o una hoja. En Safari de iPhone «overflow: hidden» en el body no basta:
// la página se sigue moviendo al arrastrar. Se fija el body en su posición actual y al cerrar se vuelve al mismo punto.
export default function useBodyScrollLock(active = true) {
  useEffect(() => {
    if (!active) return undefined;
    const { body, documentElement } = document;
    const scrollY = window.scrollY;
    const previous = {
      position: body.style.position, top: body.style.top, left: body.style.left, right: body.style.right,
      width: body.style.width, overflow: body.style.overflow, overscroll: documentElement.style.overscrollBehavior,
    };
    Object.assign(body.style, { position: 'fixed', top: `-${scrollY}px`, left: '0', right: '0', width: '100%', overflow: 'hidden' });
    documentElement.style.overscrollBehavior = 'none';
    return () => {
      Object.assign(body.style, { position: previous.position, top: previous.top, left: previous.left, right: previous.right, width: previous.width, overflow: previous.overflow });
      documentElement.style.overscrollBehavior = previous.overscroll;
      window.scrollTo({ top: scrollY, behavior: 'instant' }); // sin animación: la página queda donde estaba
    };
  }, [active]);
}
