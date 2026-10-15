import { useLayoutEffect, useRef } from 'react';

// Capturar el reloj del HTML antes de que React lo reemplace. Auth y Suspense
// montan splashes diferentes, pero el giro debe continuar, no volver a cero.
const bootRing = typeof document !== 'undefined' ? document.querySelector('#boot-splash .boot-ring') : null;
let spinStartTime = bootRing?.getAnimations?.()[0]?.startTime ?? null;

// El HTML inicial y React comparten los estilos .app-splash de index.html.
export default function AppSplash() {
  const splashRef = useRef(null);

  useLayoutEffect(() => {
    const animations = splashRef.current?.getAnimations?.({ subtree: true }) || [];
    const spin = animations.find((animation) => animation.animationName === 'boot-spin');
    if (!spin) return; // Sin animación cuando se solicita movimiento reducido.
    spinStartTime ??= document.timeline.currentTime;
    if (spinStartTime !== null) spin.startTime = spinStartTime;
  }, []);

  return (
    <div ref={splashRef} className="app-splash" role="status" aria-label="Cargando Carpetazo">
      <span className="boot-mark" aria-hidden="true">
        <img src="/images/logos/logo_completo.webp" alt="" />
        <span className="boot-ring" />
      </span>
    </div>
  );
}
