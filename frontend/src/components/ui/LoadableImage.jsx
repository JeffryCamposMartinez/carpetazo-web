import { useEffect, useRef, useState } from 'react';

// Logo de Carpetazo con un espiral girando: se muestra mientras llega la imagen de una carta.
// Se coloca sobre el contenedor de la imagen (que debe ser `relative`) o con `className` para darle otra posición.
export function LoadingMark({ still = false, compact = false, className = 'absolute inset-0' }) {
  return (
    <span aria-hidden="true" className={`pointer-events-none flex items-center justify-center ${className}`}>
      <span className={`relative flex items-center justify-center ${compact ? 'h-12 w-12' : 'h-24 w-24'}`}>
        <img src="/images/logos/logo_completo.webp" alt="" className={`object-contain ${compact ? 'h-7 w-7' : 'h-14 w-14'} ${still ? 'opacity-40 grayscale' : 'animate-pulse motion-reduce:animate-none'}`} />
        {!still && <span className={`absolute inset-0 animate-spin rounded-full border-[#1e40af]/20 border-t-[#facc15] border-r-[#1e40af] motion-reduce:animate-none ${compact ? 'border-[3px]' : 'border-4'}`} />}
      </span>
    </span>
  );
}

const NEAR_PX = 900; // se empieza a descargar la imagen cuando falta esta distancia para verla
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1500;

// Imagen de carta que muestra el logo con el espiral hasta que carga (y el logo quieto si falla).
// Su contenedor debe ser `relative`.
// Con `loading="lazy"` la descarga la decide un IntersectionObserver propio en vez del del navegador: el nativo, dentro de
// tarjetas animadas o con «transform», a veces no despierta la imagen hasta que el mouse pasa por encima.
// Si la descarga falla se reintenta sola un par de veces.
export default function LoadableImage({ src, alt, className = '', compact = false, onError, loading, ...rest }) {
  const lazy = loading === 'lazy';
  const [state, setState] = useState('loading'); // loading | loaded | failed
  const [near, setNear] = useState(!lazy);
  const [attempt, setAttempt] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    setState('loading');
    setAttempt(0);
  }, [src]);

  useEffect(() => {
    if (!lazy || near) return undefined;
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') { setNear(true); return undefined; }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { setNear(true); observer.disconnect(); }
    }, { rootMargin: `${NEAR_PX}px 0px` });
    observer.observe(node);
    return () => observer.disconnect();
  }, [lazy, near]);

  useEffect(() => {
    // Si la imagen ya estaba en caché, `load` pudo haber ocurrido antes de enlazar el evento
    if (near && ref.current?.complete && ref.current.naturalWidth > 0) setState('loaded');
  }, [near, src, attempt]);

  const handleError = (event) => {
    if (attempt < MAX_RETRIES) {
      window.setTimeout(() => setAttempt((count) => count + 1), RETRY_DELAY_MS);
    } else {
      setState('failed');
      onError?.(event);
    }
  };

  return (
    <>
      {state !== 'loaded' && <LoadingMark still={state === 'failed'} compact={compact} />}
      <img
        key={attempt}
        ref={ref}
        src={near ? src : undefined}
        alt={alt}
        referrerPolicy="no-referrer"
        decoding="async"
        className={`${className} transition-opacity duration-200 motion-reduce:transition-none ${state === 'loaded' ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setState('loaded')}
        onError={handleError}
        {...rest}
      />
    </>
  );
}
